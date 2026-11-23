/**
 * CSV detection (contracts/csv-formats.md): decode (UTF-8, falling back to
 * Windows-1252), sniff the delimiter, parse, normalize the header row and match
 * it against the known layouts.
 */
import { createHash } from 'node:crypto'
import Papa from 'papaparse'
import { isPriceList } from './price-list'

export type CsvEncoding = 'utf-8' | 'windows-1252'
export type CsvDelimiter = ';' | ',' | '\t'
export type KnownLayout =
  'sparkasse-camt-v8' | 'sparkasse-mt940' | 'scalable-transactions' | 'price-list'

export interface ParsedCsv {
  encoding: CsvEncoding
  delimiter: CsvDelimiter
  /** Original header cells (trimmed). */
  headers: string[]
  /** Data rows (header excluded); line number of rows[i] is i + 2. */
  rows: string[][]
  /** sha256 of the normalized header row; identifies saved mappings. */
  signature: string
  layout: KnownLayout | null
}

/** Required (normalized) columns per known layout. */
export const LAYOUT_COLUMNS: Record<KnownLayout, string[]> = {
  'sparkasse-camt-v8': [
    'auftragskonto',
    'buchungstag',
    'valutadatum',
    'buchungstext',
    'verwendungszweck',
    'beguenstigter/zahlungspflichtiger',
    'kontonummer/iban',
    'betrag',
    'waehrung',
  ],
  'sparkasse-mt940': [
    'auftragskonto',
    'buchungstag',
    'valutadatum',
    'buchungstext',
    'verwendungszweck',
    'beguenstigter/zahlungspflichtiger',
    'kontonummer',
    'blz',
    'betrag',
    'waehrung',
  ],
  'scalable-transactions': [
    'date',
    'status',
    'reference',
    'description',
    'type',
    'isin',
    'shares',
    'price',
    'amount',
    'fee',
    'tax',
    'currency',
  ],
  // Minimal columns; aliases (date, kurs, close) are handled in price-list.ts.
  'price-list': ['datum', 'schlusskurs'],
}

export function decode(file: Buffer): { text: string; encoding: CsvEncoding } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(file)
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('windows-1252').decode(file), encoding: 'windows-1252' }
  }
}

export function normalizeHeader(cell: string): string {
  return cell.trim().replace(/^"|"$/g, '').trim().toLowerCase()
}

/** Counts candidate delimiters outside quotes in the first line. */
export function sniffDelimiter(text: string): CsvDelimiter {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts: Record<CsvDelimiter, number> = { ';': 0, ',': 0, '\t': 0 }
  let quoted = false
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted
    else if (!quoted && char in counts) counts[char as CsvDelimiter]++
  }
  return (Object.entries(counts) as [CsvDelimiter, number][]).sort((a, b) => b[1] - a[1])[0]![0]
}

export function headerSignature(headers: readonly string[]): string {
  return createHash('sha256').update(headers.map(normalizeHeader).join('|')).digest('hex')
}

function detectLayout(headers: readonly string[]): KnownLayout | null {
  const present = new Set(headers.map(normalizeHeader))
  // MT940 is checked first: its columns are a superset-variant of CAMT ("kontonummer" + "blz").
  const order: KnownLayout[] = ['sparkasse-mt940', 'sparkasse-camt-v8', 'scalable-transactions']
  const known = order.find((layout) =>
    LAYOUT_COLUMNS[layout].every((column) => present.has(column)),
  )
  if (known) return known
  return isPriceList(headers) ? 'price-list' : null
}

export function parseCsv(
  file: Buffer,
  options: { delimiter?: CsvDelimiter; encoding?: CsvEncoding; skipRows?: number } = {},
): ParsedCsv {
  const decoded = options.encoding
    ? {
        text: new TextDecoder(options.encoding).decode(file).replace(/^\uFEFF/, ''),
        encoding: options.encoding,
      }
    : decode(file)
  const lines = decoded.text.split(/\r?\n/)
  const text = lines.slice(options.skipRows ?? 0).join('\n')
  const delimiter = options.delimiter ?? sniffDelimiter(text)
  const result = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: 'greedy' })
  const [headerRow = [], ...rows] = result.data
  const headers = headerRow.map((cell) => cell.trim())
  return {
    encoding: decoded.encoding,
    delimiter,
    headers,
    rows: rows.map((row) => row.map((cell) => cell.trim())),
    signature: headerSignature(headers),
    layout: detectLayout(headers),
  }
}

/** Index of a normalized column name in the header row (or -1). */
export function columnIndex(headers: readonly string[], name: string): number {
  return headers.findIndex((header) => normalizeHeader(header) === name)
}
