import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/modules/sources/csv/detector'
import { parseScalable } from '../../src/modules/sources/csv/scalable'

const header =
  'date;time;status;reference;description;assetType;type;isin;shares;price;amount;fee;tax;currency'
const parse = (...rows: string[]) =>
  parseScalable(parseCsv(Buffer.from([header, ...rows].join('\n'))))

describe('Scalable transactions CSV', () => {
  const batch = parseScalable(
    parseCsv(readFileSync(join(__dirname, '../fixtures/csv/scalable-transactions.csv'))),
  )

  it('imports executed rows and skips cancelled ones', () => {
    expect(batch.transactions).toHaveLength(8)
    expect(batch.rowErrors).toEqual([{ line: 10, reason: 'not_executed' }])
  })

  it('maps types, quantities, fees and taxes', () => {
    expect(batch.transactions.map((tx) => tx.type)).toEqual([
      'deposit',
      'buy',
      'buy',
      'buy',
      'buy',
      'sell',
      'dividend',
      'interest',
    ])
    const sell = batch.transactions[5]!
    expect(sell).toMatchObject({
      sourceRef: 'SCDEMO0006',
      isin: 'US0378331005',
      quantity: '1',
      unitPrice: '160',
      amountCents: 15851,
      feeCents: 99,
      taxCents: 50,
      accountExternalRef: 'scalable-depot',
    })
    expect(batch.transactions[1]?.quantity).toBe('1.25')
    expect(batch.transactions[0]?.accountExternalRef).toBe('scalable-cash')
  })

  it('creates depot, reference account, instruments and trade prices', () => {
    expect(batch.accounts.map((acc) => [acc.externalRef, acc.type])).toEqual([
      ['scalable-depot', 'depot'],
      ['scalable-cash', 'reference'],
    ])
    expect(batch.instruments.map((instrument) => [instrument.isin, instrument.assetClass])).toEqual(
      [
        ['IE00B4L5Y983', 'etf'],
        ['US0378331005', 'stock'],
        ['IE00B3RBWM25', 'etf'],
      ],
    )
    expect(batch.prices).toContainEqual({ isin: 'US0378331005', date: '2026-11-10', close: '160' })
  })

  it('reports missing or invalid ISINs and missing quantities', () => {
    const result = parse(
      '2026-11-01;;Executed;R1;X;Security;Buy;;1;10,00;-10,00;0;0;EUR',
      '2026-11-01;;Executed;R2;X;Security;Buy;IE00B4L5Y984;1;10,00;-10,00;0;0;EUR',
      '2026-11-01;;Executed;R3;X;Security;Sell;IE00B4L5Y983;;10,00;10,00;0;0;EUR',
      '2026-11-01;;Executed;R4;X;Security;Buy;IE00B4L5Y983;1;10,00;-10,00;0;0;USD',
    )
    expect(result.rowErrors).toEqual([
      { line: 2, reason: 'missing_isin' },
      { line: 3, reason: 'invalid_isin' },
      { line: 4, reason: 'missing_quantity' },
      { line: 5, reason: 'unknown_currency_no_rate' },
    ])
    expect(result.transactions).toEqual([])
  })
})
