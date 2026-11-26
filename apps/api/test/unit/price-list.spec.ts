import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/modules/sources/csv/detector'
import { isPriceList, parsePriceList } from '../../src/modules/sources/csv/price-list'

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures/csv', name))

describe('price list CSV (Kursliste)', () => {
  it('detects the layout and parses German dates and decimal commas', () => {
    const csv = parseCsv(fixture('price-list.csv'))
    expect(csv.layout).toBe('price-list')
    const result = parsePriceList(csv)
    expect(result.hasIsinColumn).toBe(false)
    expect(result.rows.map((r) => [r.date, r.close])).toEqual([
      ['2026-01-02', '98.5'],
      ['2026-01-05', '99.1'],
      ['2026-01-06', '1001.25'],
    ])
    expect(result.errors).toEqual([
      { line: 5, reason: 'Ungültiges Datum' },
      { line: 6, reason: 'Ungültiger Kurs' },
    ])
  })

  it('reads an ISIN column, ISO dates and decimal points', () => {
    const csv = parseCsv(fixture('price-list-isin.csv'))
    expect(csv.layout).toBe('price-list')
    const result = parsePriceList(csv)
    expect(result.hasIsinColumn).toBe(true)
    expect(result.rows).toHaveLength(4)
    expect(result.rows[0]).toMatchObject({
      isin: 'IE00B5BMR087',
      date: '2026-01-02',
      close: '500.1',
    })
    expect(result.errors).toEqual([{ line: 5, reason: 'Ungültige ISIN' }])
  })

  it('does not take transaction exports for price lists', () => {
    expect(isPriceList(['Datum', 'Schlusskurs'])).toBe(true)
    expect(isPriceList(['Date', 'Close'])).toBe(true)
    expect(isPriceList(['Datum', 'Kurs', 'Betrag'])).toBe(false)
    expect(isPriceList(['Datum', 'Betrag'])).toBe(false)
  })
})
