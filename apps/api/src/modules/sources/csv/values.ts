/** Parsing helpers for bank CSV cell values. */
import { D } from '../../../domain/money'

export type DateFormat = 'DD.MM.YYYY' | 'DD.MM.YY' | 'YYYY-MM-DD'
export type DecimalSeparator = ',' | '.'

/** Parses a date in the given format to `YYYY-MM-DD`; `null` if invalid (e.g. 31.02.). */
export function parseDate(value: string, format: DateFormat): string | null {
  const trimmed = value.trim()
  let day: number
  let month: number
  let year: number
  if (format === 'YYYY-MM-DD') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
    if (!match) return null
    ;[year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else {
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(trimmed)
    if (!match) return null
    day = Number(match[1])
    month = Number(match[2])
    year = Number(match[3])
    if (match[3]!.length === 2) year += 2000
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date.toISOString().slice(0, 10)
}

/**
 * Parses a decimal number (`2.480,00`, `-12,99`, `1500.00`) to a normalized
 * decimal string; `null` if it is not a number.
 */
export function parseDecimal(value: string, separator: DecimalSeparator): string | null {
  let text = value.trim().replace(/\s|€|EUR/g, '')
  if (text === '') return null
  if (separator === ',') text = text.replace(/\./g, '').replace(',', '.')
  else text = text.replace(/,/g, '')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null
  return new D(text).toString()
}

/** Parses an amount to integer cents; `null` if invalid. */
export function parseCents(value: string, separator: DecimalSeparator): number | null {
  const decimal = parseDecimal(value, separator)
  if (decimal === null) return null
  return new D(decimal).times(100).toDecimalPlaces(0, D.ROUND_HALF_EVEN).toNumber()
}

/** Cell by column index, empty string when missing. */
export function cell(row: readonly string[], index: number | undefined): string {
  return index === undefined || index < 0 ? '' : (row[index] ?? '').trim()
}
