import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/modules/sources/csv/detector'
import { parseSparkasse } from '../../src/modules/sources/csv/sparkasse'
import { parseCents, parseDate, parseDecimal } from '../../src/modules/sources/csv/values'

const fixture = (name: string) => parseCsv(readFileSync(join(__dirname, '../fixtures/csv', name)))

describe('value parsing', () => {
  it('parses German and ISO dates and rejects impossible ones', () => {
    expect(parseDate('01.11.26', 'DD.MM.YY')).toBe('2026-11-01')
    expect(parseDate('1.2.2026', 'DD.MM.YYYY')).toBe('2026-02-01')
    expect(parseDate('2026-11-01', 'YYYY-MM-DD')).toBe('2026-11-01')
    expect(parseDate('31.02.26', 'DD.MM.YY')).toBeNull()
    expect(parseDate('heute', 'DD.MM.YY')).toBeNull()
  })

  it('parses amounts with both separators', () => {
    expect(parseCents('2.480,00', ',')).toBe(248000)
    expect(parseCents('-12,99', ',')).toBe(-1299)
    expect(parseCents('1500.00', '.')).toBe(150000)
    expect(parseCents('1,234.5', '.')).toBe(123450)
    expect(parseCents('zehn Euro', ',')).toBeNull()
    expect(parseDecimal('1,25', ',')).toBe('1.25')
  })
})

describe('Sparkasse CAMT V8', () => {
  const batch = parseSparkasse(fixture('sparkasse-camt-v8.csv'), 'camt')

  it('maps all rows to transactions of one checking account', () => {
    expect(batch.rowErrors).toEqual([])
    expect(batch.transactions).toHaveLength(8)
    expect(batch.accounts).toEqual([
      {
        externalRef: 'DE89370400440532013000',
        name: 'Sparkasse Girokonto …3000',
        type: 'checking',
        iban: 'DE89370400440532013000',
        institutionName: 'Sparkasse',
      },
    ])
    const total = batch.transactions.reduce((sum, tx) => sum + tx.amountCents, 0)
    expect(total).toBe(136777)
  })

  it('maps sign to type and keeps counterparty, IBAN and purpose', () => {
    const [salary, rent] = batch.transactions
    expect(salary).toMatchObject({
      bookingDate: '2026-11-01',
      amountCents: 248000,
      type: 'income',
      counterparty: 'Demo Arbeitgeber GmbH',
      counterpartyIban: 'DE02120300000000202051',
    })
    expect(rent?.type).toBe('expense')
    expect(rent?.purpose).toBe('DAUERAUFTRAG · Miete November')
    expect(batch.transactions[6]?.purpose).toContain('Bürobedarf')
  })
})

describe('Sparkasse MT940', () => {
  it('parses rows and marks account fees', () => {
    const batch = parseSparkasse(fixture('sparkasse-mt940.csv'), 'mt940')
    expect(batch.transactions.map((tx) => [tx.amountCents, tx.type])).toEqual([
      [1999, 'income'],
      [-1299, 'expense'],
      [-495, 'fee'],
    ])
  })
})

describe('row errors', () => {
  it('reports invalid dates and amounts with line numbers and keeps valid rows', () => {
    const batch = parseSparkasse(fixture('malformed.csv'), 'camt')
    expect(batch.transactions).toHaveLength(2)
    expect(batch.rowErrors).toEqual([
      { line: 3, reason: 'invalid_date' },
      { line: 4, reason: 'invalid_amount' },
    ])
  })
})
