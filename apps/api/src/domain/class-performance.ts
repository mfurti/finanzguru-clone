/**
 * Per-asset-class lines for the performance chart (005 US2, research R5).
 *
 * Value line (€ view): the class's daily market value, 0 while nothing is held.
 * Return line (% view): time-weighted return chained from the class's own values and flows,
 * r_t = (V_t − F_t) / V_{t−1} − 1, with r_t = 0 when V_{t−1} = 0. A buy does not count as gain,
 * a sale realizes the last price, and the line stays flat while the class is not held.
 */
import type { AssetClass } from '@finance/shared'
import { D, type DecimalValue } from './money'
import { eachDay } from './period'

export interface ClassDayRow {
  date: string
  assetClass: AssetClass
  valueCents: number
  /** Net buys (+) minus sells (−) on that day. */
  flowCents: number
}

export interface ClassPoint {
  valueCents: number
  /** Cumulative return as a ratio with 6 places; null before the first holding. */
  twrorPct: string | null
}

export interface ClassSeriesDay {
  date: string
  total: ClassPoint
  byClass: Partial<Record<AssetClass, ClassPoint>>
}

/** Places of the return ratio, like the other `…Pct` fields. */
const PLACES = 6

/** Chains the daily returns of one line over `days`. */
function chain(days: readonly string[], values: Map<string, { v: number; f: number }>) {
  let factor: DecimalValue = new D(1)
  let previous = 0
  let started = false
  return days.map((date): ClassPoint => {
    const day = values.get(date) ?? { v: 0, f: 0 }
    if (started && previous > 0) {
      factor = factor.times(new D(day.v - day.f).div(previous))
    }
    if (day.v > 0 || day.f !== 0) started = true
    previous = day.v
    return {
      valueCents: day.v,
      twrorPct: started ? factor.minus(1).toDecimalPlaces(PLACES).toFixed(PLACES) : null,
    }
  })
}

/**
 * Daily series for `[from, to]`: the "Alle" line plus one line per class that was held at
 * some point in the range. `rows` may hold several instruments per class and day.
 */
export function classSeries(
  rows: readonly ClassDayRow[],
  from: string,
  to: string,
): { classes: AssetClass[]; series: ClassSeriesDay[] } {
  const days = eachDay(from, to)
  const total = new Map<string, { v: number; f: number }>()
  const perClass = new Map<AssetClass, Map<string, { v: number; f: number }>>()
  for (const row of rows) {
    if (row.date < from || row.date > to) continue
    const lines = perClass.get(row.assetClass) ?? new Map()
    perClass.set(row.assetClass, lines)
    for (const map of [total, lines]) {
      const day = map.get(row.date) ?? { v: 0, f: 0 }
      day.v += row.valueCents
      day.f += row.flowCents
      map.set(row.date, day)
    }
  }
  const classes = [...perClass.keys()]
    .filter((assetClass) => [...perClass.get(assetClass)!.values()].some((day) => day.v > 0))
    .sort()
  const totalLine = chain(days, total)
  const classLines = new Map(
    classes.map((assetClass) => [assetClass, chain(days, perClass.get(assetClass)!)]),
  )
  return {
    classes,
    series: days.map((date, index) => ({
      date,
      total: totalLine[index]!,
      byClass: Object.fromEntries(
        classes.map((assetClass) => [assetClass, classLines.get(assetClass)![index]!]),
      ),
    })),
  }
}
