/**
 * Returns by month and year (feature 002, research R4/R5), built on the
 * 001 formulas in returns.ts so the Analyse page agrees with the KPI card.
 *
 * - Cumulative TWROR series: chained daily factors r_t = V_t/(V_{t-1}+F_t) − 1.
 * - Monthly TWROR: the same factors chained within each calendar month.
 * - Yearly TWROR: product of the year's monthly factors (heatmap = table).
 * - Yearly IZF: XIRR over the year's slice, exactly like the KPI card.
 */
import { D } from './money'
import { periodCashFlows, realReturn, twror, type ValuePoint, xirr } from './returns'

/** Daily factor of point i (null when nothing was invested). */
function dailyFactor(series: readonly ValuePoint[], i: number): InstanceType<typeof D> | null {
  const previous = series[i - 1]!
  const current = series[i]!
  const base = new D(previous.valueCents).plus(current.flowCents)
  if (base.lte(0)) return null
  return new D(current.valueCents).dividedBy(base)
}

/** Cumulative TWROR per day, starting at 0 on the first point. */
export function cumulativeTwror(series: readonly ValuePoint[]): { date: string; twror: string }[] {
  if (series.length === 0) return []
  let factor = new D(1)
  const points = [{ date: series[0]!.date, twror: '0' }]
  for (let i = 1; i < series.length; i++) {
    const f = dailyFactor(series, i)
    if (f) factor = factor.times(f)
    points.push({ date: series[i]!.date, twror: factor.minus(1).toDecimalPlaces(8).toString() })
  }
  return points
}

export interface MonthlyReturn {
  year: number
  month: number
  twror: string | null
}

export function monthlyReturns(series: readonly ValuePoint[]): MonthlyReturn[] {
  const months = new Map<string, { factor: InstanceType<typeof D>; any: boolean }>()
  for (let i = 1; i < series.length; i++) {
    const key = series[i]!.date.slice(0, 7)
    const entry = months.get(key) ?? { factor: new D(1), any: false }
    const f = dailyFactor(series, i)
    if (f) {
      entry.factor = entry.factor.times(f)
      entry.any = true
    }
    months.set(key, entry)
  }
  return [...months.entries()].map(([key, entry]) => ({
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)),
    twror: entry.any ? entry.factor.minus(1).toDecimalPlaces(10).toString() : null,
  }))
}

export interface YearlyReturnRow {
  year: number
  twror: string | null
  xirr: string | null
  inflation: string
  realReturn: string | null
  ytd: boolean
}

export function yearlyReturns(
  series: readonly ValuePoint[],
  inflationFor: (year: number) => string,
  today: string,
): YearlyReturnRow[] {
  const months = monthlyReturns(series)
  const years = [...new Set(series.map((point) => Number(point.date.slice(0, 4))))].sort()
  const currentYear = Number(today.slice(0, 4))
  return years.map((year) => {
    const inYear = months.filter((m) => m.year === year && m.twror !== null)
    const twr =
      inYear.length === 0
        ? null
        : inYear
            .reduce((factor, m) => factor.times(new D(m.twror!).plus(1)), new D(1))
            .minus(1)
            .toDecimalPlaces(10)
            .toString()
    const slice = series.filter((point) => point.date.startsWith(String(year)))
    const irr = slice.length >= 2 ? xirr(periodCashFlows(slice)) : null
    const inflation = inflationFor(year)
    return {
      year,
      twror: twr,
      xirr: irr,
      inflation,
      realReturn: realReturn(irr ?? twr, inflation),
      ytd: year === currentYear,
    }
  })
}

/** TWROR of a slice; re-exported for callers that compare with the KPI card. */
export { twror }
