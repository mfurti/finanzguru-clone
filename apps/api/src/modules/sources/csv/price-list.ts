/**
 * "Kursliste" CSV (feature 002, research R10): daily closes for one or more
 * instruments. Header `Datum;Schlusskurs` (aliases `Date`, `Kurs`, `Close`),
 * optional `ISIN`; dates `DD.MM.YYYY` or ISO, decimal comma or point.
 */
import { isValidIsin } from '@finance/shared'
import { D } from '../../../domain/money'
import type { ParsedCsv } from './detector'
import { cell, parseDate, parseDecimal } from './values'

export interface PriceRow {
  line: number
  isin: string | null
  date: string
  close: string
}

export interface PriceListResult {
  rows: PriceRow[]
  errors: { line: number; reason: string }[]
  hasIsinColumn: boolean
}

const DATE_COLUMNS = ['datum', 'date']
const CLOSE_COLUMNS = ['schlusskurs', 'kurs', 'close']

const normalize = (value: string) => value.trim().replace(/^"|"$/g, '').trim().toLowerCase()

function firstColumn(headers: readonly string[], names: readonly string[]): number {
  const normalized = headers.map(normalize)
  for (const name of names) {
    const index = normalized.indexOf(name)
    if (index >= 0) return index
  }
  return -1
}

/** True when the header has a date and a close column but no transaction amount. */
export function isPriceList(headers: readonly string[]): boolean {
  const normalized = headers.map(normalize)
  return (
    firstColumn(headers, DATE_COLUMNS) >= 0 &&
    firstColumn(headers, CLOSE_COLUMNS) >= 0 &&
    !normalized.includes('betrag') &&
    !normalized.includes('amount')
  )
}

function parseAnyDate(value: string): string | null {
  return parseDate(value, 'DD.MM.YYYY') ?? parseDate(value, 'YYYY-MM-DD')
}

/** `1.234,56` and `1234,56` use a decimal comma; `1234.56` a point. */
function parseAnyDecimal(value: string): string | null {
  return parseDecimal(value, value.includes(',') ? ',' : '.')
}

export function parsePriceList(csv: Pick<ParsedCsv, 'headers' | 'rows'>): PriceListResult {
  const dateIndex = firstColumn(csv.headers, DATE_COLUMNS)
  const closeIndex = firstColumn(csv.headers, CLOSE_COLUMNS)
  const isinIndex = firstColumn(csv.headers, ['isin'])
  const rows: PriceRow[] = []
  const errors: PriceListResult['errors'] = []

  csv.rows.forEach((row, i) => {
    const line = i + 2
    const date = parseAnyDate(cell(row, dateIndex))
    if (!date) {
      errors.push({ line, reason: 'Ungültiges Datum' })
      return
    }
    const close = parseAnyDecimal(cell(row, closeIndex))
    if (!close || new D(close).lte(0)) {
      errors.push({ line, reason: 'Ungültiger Kurs' })
      return
    }
    let isin: string | null = null
    if (isinIndex >= 0) {
      isin = cell(row, isinIndex).toUpperCase()
      if (!isValidIsin(isin)) {
        errors.push({ line, reason: 'Ungültige ISIN' })
        return
      }
    }
    rows.push({ line, isin, date, close })
  })
  return { rows, errors, hasIsinColumn: isinIndex >= 0 }
}
