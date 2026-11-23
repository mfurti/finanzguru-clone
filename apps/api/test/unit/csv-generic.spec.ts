import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCsv } from '../../src/modules/sources/csv/detector'
import { parseGenericMapped } from '../../src/modules/sources/csv/generic-mapped'

describe('generic mapped CSV', () => {
  it('imports the unknown-layout fixture with a manual mapping', () => {
    const csv = parseCsv(readFileSync(join(__dirname, '../fixtures/csv/unknown-layout.csv')))
    const batch = parseGenericMapped(csv, {
      columns: { date: 0, amount: 1, counterparty: 2, purpose: 3 },
      dateFormat: 'YYYY-MM-DD',
      decimalSeparator: '.',
    })
    expect(batch.rowErrors).toEqual([])
    expect(batch.transactions.map((tx) => [tx.bookingDate, tx.amountCents, tx.type])).toEqual([
      ['2026-11-01', 150000, 'income'],
      ['2026-11-03', -42050, 'expense'],
      ['2026-11-09', -3310, 'expense'],
    ])
    expect(batch.transactions[1]?.counterparty).toBe('Demo Vermieter')
  })

  it('supports German formats, skip rows, type words and security rows', () => {
    const file = Buffer.from(
      [
        'Mein Export',
        'Datum;Betrag;Art;ISIN;Stück;Kurs',
        '01.11.2026;-100,00;Kauf;IE00B4L5Y983;1,5;66,67',
        '02.11.2026;12,34;Dividende;IE00B4L5Y983;;',
        '03.11.2026;-5,00;;;;',
        '04.11.2026;-5,00;Kauf;;1;5',
      ].join('\n'),
    )
    const csv = parseCsv(file, { skipRows: 1, delimiter: ';' })
    const batch = parseGenericMapped(csv, {
      columns: { date: 0, amount: 1, type: 2, isin: 3, quantity: 4, price: 5 },
      dateFormat: 'DD.MM.YYYY',
      decimalSeparator: ',',
    })
    expect(batch.transactions.map((tx) => [tx.type, tx.quantity, tx.unitPrice])).toEqual([
      ['buy', '1.5', '66.67'],
      ['dividend', undefined, undefined],
      ['expense', undefined, undefined],
    ])
    expect(batch.instruments).toHaveLength(1)
    expect(batch.rowErrors).toEqual([{ line: 5, reason: 'missing_isin' }])
  })
})
