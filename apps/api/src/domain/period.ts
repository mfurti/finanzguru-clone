/**
 * Calendar helpers on `YYYY-MM-DD` strings, computed in UTC so results never
 * depend on the server's time zone.
 */
import type { Period } from '@finance/shared'

export interface DateRange {
  from: string
  to: string
}

export type Granularity = 'month' | 'quarter' | 'year'

export interface PeriodBounds extends DateRange {
  label: string
}

const MONTHS_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const d = parse(date)
  d.setUTCDate(d.getUTCDate() + days)
  return toIsoDate(d)
}

/** Adds months, clamping to the last day (31.03 − 1 month = 28/29.02). */
export function addMonths(date: string, months: number): string {
  const d = parse(date)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return toIsoDate(d)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)
}

/** Inclusive list of dates from `from` to `to`. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now)
}

/**
 * Resolves a chart period to a date range ending at `today`.
 * `ALL` starts at the first data date; any range starts no earlier than it.
 */
export function resolvePeriod(period: Period, today: string, firstDataDate?: string): DateRange {
  let from: string
  switch (period) {
    case '1W':
      from = addDays(today, -7)
      break
    case '1M':
      from = addMonths(today, -1)
      break
    case 'YTD':
      from = `${today.slice(0, 4)}-01-01`
      break
    case '1Y':
      from = addMonths(today, -12)
      break
    case '3Y':
      from = addMonths(today, -36)
      break
    case '5Y':
      from = addMonths(today, -60)
      break
    case 'ALL':
      from = firstDataDate ?? today
      break
  }
  if (firstDataDate && from < firstDataDate) from = firstDataDate
  return { from, to: today }
}

/** `from`/`to` from the query override `period` (contracts/http-api.md). */
export function resolveRange(
  query: { period: Period; from?: string; to?: string },
  today: string,
  firstDataDate?: string,
): DateRange {
  if (query.from || query.to) {
    const to = query.to ?? today
    return { from: query.from ?? resolvePeriod(query.period, to, firstDataDate).from, to }
  }
  return resolvePeriod(query.period, today, firstDataDate)
}

/** Month / quarter / year containing `anchor`, with a German label. */
export function periodBounds(granularity: Granularity, anchor: string): PeriodBounds {
  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7)) - 1
  let startMonth: number
  let months: number
  let label: string
  switch (granularity) {
    case 'month':
      startMonth = month
      months = 1
      label = `${MONTHS_DE[month]} ${year}`
      break
    case 'quarter':
      startMonth = Math.floor(month / 3) * 3
      months = 3
      label = `Q${startMonth / 3 + 1} ${year}`
      break
    case 'year':
      startMonth = 0
      months = 12
      label = String(year)
      break
  }
  const from = toIsoDate(new Date(Date.UTC(year, startMonth, 1)))
  const to = toIsoDate(new Date(Date.UTC(year, startMonth + months, 0)))
  return { from, to, label }
}

/** Moves the anchor by `steps` periods (negative = back) and returns that period. */
export function shiftPeriod(granularity: Granularity, anchor: string, steps: number): PeriodBounds {
  const monthsPerStep = granularity === 'month' ? 1 : granularity === 'quarter' ? 3 : 12
  const start = periodBounds(granularity, anchor).from
  return periodBounds(granularity, addMonths(start, steps * monthsPerStep))
}

/** The `count` periods ending with the one containing `anchor`, oldest first. */
export function lastPeriods(
  granularity: Granularity,
  anchor: string,
  count: number,
): PeriodBounds[] {
  return Array.from({ length: count }, (_, index) =>
    shiftPeriod(granularity, anchor, index - (count - 1)),
  )
}
