/**
 * Dividend figures (feature 002, research R7). Amounts are the net dividend
 * bookings (tax already withheld), in cents.
 */
import { D, ratio } from './money'
import { addMonths } from './period'

export interface DividendBooking {
  date: string
  instrumentId: string
  cents: number
}

export interface DividendYear {
  year: number
  cents: number
  changePct: string | null
}

export interface DividendFigures {
  last12Cents: number
  avgPerMonthCents: number
  ytdCents: number
  yieldYtd: string | null
  cagr: string | null
  years: DividendYear[]
}

const sum = (rows: readonly DividendBooking[]) => rows.reduce((total, row) => total + row.cents, 0)

/**
 * - last 12 months: bookings after `today − 12 months` up to today
 * - Ø per month: that sum / 12 (half-even)
 * - yield YTD: dividends this year / average depot value this year
 * - CAGR: from the first to the last full year with income, needs 2 such years
 */
export function dividendFigures(
  bookings: readonly DividendBooking[],
  today: string,
  averageDepotValueYtdCents: number | null,
): DividendFigures {
  const from = addMonths(today, -12)
  const last12Cents = sum(bookings.filter((b) => b.date > from && b.date <= today))
  const currentYear = Number(today.slice(0, 4))
  const ytdCents = sum(
    bookings.filter((b) => b.date.startsWith(String(currentYear)) && b.date <= today),
  )

  const byYear = new Map<number, number>()
  for (const booking of bookings) {
    if (booking.date > today) continue
    const year = Number(booking.date.slice(0, 4))
    byYear.set(year, (byYear.get(year) ?? 0) + booking.cents)
  }
  const years = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, cents]) => {
      const previous = byYear.get(year - 1)
      return {
        year,
        cents,
        changePct: previous ? ratio(cents - previous, previous, 6) : null,
      }
    })

  const full = years.filter((y) => y.year < currentYear && y.cents > 0)
  let cagr: string | null = null
  if (full.length >= 2) {
    const first = full[0]!
    const last = full.at(-1)!
    const span = last.year - first.year
    cagr = new D(last.cents)
      .dividedBy(first.cents)
      .pow(new D(1).dividedBy(span))
      .minus(1)
      .toDecimalPlaces(6)
      .toString()
  }

  return {
    last12Cents,
    avgPerMonthCents: new D(last12Cents).dividedBy(12).toDecimalPlaces(0).toNumber(),
    ytdCents,
    yieldYtd:
      averageDepotValueYtdCents && averageDepotValueYtdCents > 0
        ? ratio(ytdCents, averageDepotValueYtdCents, 6)
        : null,
    cagr,
    years,
  }
}

/** Dividends per instrument with share of the total, largest first. */
export function dividendsBySecurity(
  bookings: readonly DividendBooking[],
): { instrumentId: string; cents: number; pct: string | null }[] {
  const total = sum(bookings)
  const per = new Map<string, number>()
  for (const b of bookings) per.set(b.instrumentId, (per.get(b.instrumentId) ?? 0) + b.cents)
  return [...per.entries()]
    .map(([instrumentId, cents]) => ({ instrumentId, cents, pct: ratio(cents, total, 6) }))
    .sort((a, b) => b.cents - a.cents)
}

/** True when a received dividend exists for the instrument in the month of `date`. */
export function isReceived(
  bookings: readonly DividendBooking[],
  instrumentId: string,
  date: string,
): boolean {
  const month = date.slice(0, 7)
  return bookings.some((b) => b.instrumentId === instrumentId && b.date.startsWith(month))
}
