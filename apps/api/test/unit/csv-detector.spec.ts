import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decode,
  headerSignature,
  parseCsv,
  sniffDelimiter,
} from '../../src/modules/sources/csv/detector'

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures/csv', name))

describe('CSV detector', () => {
  it('detects the Sparkasse CAMT V8 export in Windows-1252', () => {
    const parsed = parseCsv(fixture('sparkasse-camt-v8.csv'))
    expect(parsed.encoding).toBe('windows-1252')
    expect(parsed.delimiter).toBe(';')
    expect(parsed.layout).toBe('sparkasse-camt-v8')
    expect(parsed.rows).toHaveLength(8)
    expect(parsed.rows[6]?.[4]).toBe('Bürobedarf')
  })

  it('detects MT940 and Scalable layouts', () => {
    expect(parseCsv(fixture('sparkasse-mt940.csv')).layout).toBe('sparkasse-mt940')
    const scalable = parseCsv(fixture('scalable-transactions.csv'))
    expect(scalable.encoding).toBe('utf-8')
    expect(scalable.layout).toBe('scalable-transactions')
    expect(scalable.rows).toHaveLength(9)
  })

  it('returns no layout for unknown headers but a stable signature', () => {
    const parsed = parseCsv(fixture('unknown-layout.csv'))
    expect(parsed.layout).toBeNull()
    expect(parsed.delimiter).toBe(',')
    expect(parsed.headers).toEqual(['Datum', 'Betrag', 'Empfaenger', 'Zweck', 'Kategorie'])
    expect(parsed.signature).toBe(
      headerSignature([' datum', 'BETRAG', 'empfaenger', 'zweck', 'kategorie']),
    )
  })

  it('strips a UTF-8 BOM and sniffs tab delimiters', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('a\tb\n1\t2\n')])
    expect(decode(withBom).text.startsWith('a')).toBe(true)
    expect(sniffDelimiter('a\tb;c\td')).toBe('\t')
  })

  it('ignores delimiters inside quotes', () => {
    expect(sniffDelimiter('"a;b;c",x,y')).toBe(',')
  })

  it('skips leading rows', () => {
    const parsed = parseCsv(Buffer.from('Export vom 01.11.\n\nDatum;Betrag\n01.11.2026;1,00\n'), {
      skipRows: 2,
    })
    expect(parsed.headers).toEqual(['Datum', 'Betrag'])
    expect(parsed.rows).toEqual([['01.11.2026', '1,00']])
  })
})
