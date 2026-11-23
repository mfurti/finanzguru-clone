/**
 * Benchmark return series (feature 002, research R11): close_t / close_base − 1
 * per day, last price carried forward (stale after 4 days, as in 001). The base
 * is the last close on or before `from`, else the first close after it; days
 * before the first available price are left out.
 */
import { D } from './money'
import { daysBetween, eachDay } from './period'
import { STALE_AFTER_DAYS } from './snapshots'

export interface BenchmarkSeriesResult {
  points: { date: string; return: string }[]
  stale: boolean
}

export function benchmarkSeries(
  prices: readonly { date: string; close: string }[],
  range: { from: string; to: string },
): BenchmarkSeriesResult {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0 || range.from > range.to) return { points: [], stale: false }

  let index = 0
  let current: { date: string; close: string } | undefined
  while (index < sorted.length && sorted[index]!.date <= range.from) current = sorted[index++]

  let base = current ? new D(current.close) : null
  const points: BenchmarkSeriesResult['points'] = []
  for (const day of eachDay(range.from, range.to)) {
    while (index < sorted.length && sorted[index]!.date <= day) current = sorted[index++]
    if (!current) continue
    if (!base) base = new D(current.close)
    points.push({
      date: day,
      return: new D(current.close).dividedBy(base).minus(1).toDecimalPlaces(8).toString(),
    })
  }
  const lastDate = current?.date
  return {
    points,
    stale: lastDate === undefined || daysBetween(lastDate, range.to) > STALE_AFTER_DAYS,
  }
}
