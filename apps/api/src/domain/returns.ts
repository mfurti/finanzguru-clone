/**
 * Return calculations (research R8).
 *
 * TWROR: daily sub-period returns chained geometrically. External flows are
 * treated as happening at the start of the day: r_t = V_t / (V_{t-1} + F_t) − 1.
 * This is the plan's (V_t − F_t)/V_{t−1} − 1 rearranged so a first purchase on
 * an empty depot (V_{t−1} = 0) is defined.
 *
 * IRR (IZF): XIRR on dated cash flows from the investor's view (payments
 * negative, start value negative, end value positive), Actual/365.
 */
import { D, type DecimalValue } from './money'
import { daysBetween } from './period'

export interface ValuePoint {
  date: string
  valueCents: number
  /** External flow into the portfolio on that day (+ deposit/buy, − withdrawal/sell). */
  flowCents: number
}

/** Time-weighted rate of return over the series; `null` if nothing was invested. */
export function twror(series: readonly ValuePoint[]): string | null {
  if (series.length < 2) return null
  let factor = new D(1)
  let anyPeriod = false
  for (let i = 1; i < series.length; i++) {
    const previous = series[i - 1]!
    const current = series[i]!
    const base = new D(previous.valueCents).plus(current.flowCents)
    if (base.lte(0)) continue
    factor = factor.times(new D(current.valueCents).dividedBy(base))
    anyPeriod = true
  }
  return anyPeriod ? factor.minus(1).toDecimalPlaces(10).toString() : null
}

export interface DatedCashFlow {
  date: string
  /** Investor's view: money paid in is negative, money received is positive. */
  amountCents: number
}

function npv(flows: readonly DatedCashFlow[], rate: DecimalValue, start: string): DecimalValue {
  const base = rate.plus(1)
  return flows.reduce((sum, flow) => {
    const years = new D(daysBetween(start, flow.date)).dividedBy(365)
    return sum.plus(new D(flow.amountCents).dividedBy(base.pow(years)))
  }, new D(0))
}

function npvDerivative(
  flows: readonly DatedCashFlow[],
  rate: DecimalValue,
  start: string,
): DecimalValue {
  const base = rate.plus(1)
  return flows.reduce((sum, flow) => {
    const years = new D(daysBetween(start, flow.date)).dividedBy(365)
    if (years.isZero()) return sum
    return sum.minus(years.times(flow.amountCents).dividedBy(base.pow(years.plus(1))))
  }, new D(0))
}

/**
 * XIRR: Newton–Raphson from 10 %, falling back to bisection on [−99.99 %, 1000 %].
 * Returns `null` when the flows have no sign change or no root is found.
 */
export function xirr(flows: readonly DatedCashFlow[], tolerance = 1e-10): string | null {
  const relevant = flows.filter((flow) => flow.amountCents !== 0)
  if (relevant.length < 2) return null
  if (
    !relevant.some((flow) => flow.amountCents < 0) ||
    !relevant.some((flow) => flow.amountCents > 0)
  ) {
    return null
  }
  const sorted = [...relevant].sort((a, b) => a.date.localeCompare(b.date))
  const start = sorted[0]!.date
  const tol = new D(tolerance)

  let rate = new D(0.1)
  for (let i = 0; i < 100; i++) {
    const value = npv(sorted, rate, start)
    const slope = npvDerivative(sorted, rate, start)
    if (slope.isZero()) break
    const next = rate.minus(value.dividedBy(slope))
    if (next.lte(-1) || !next.isFinite()) break
    if (next.minus(rate).abs().lt(tol)) return next.toDecimalPlaces(10).toString()
    rate = next
  }

  let low = new D(-0.9999)
  let high = new D(10)
  let fLow = npv(sorted, low, start)
  const fHigh = npv(sorted, high, start)
  if (fLow.times(fHigh).gt(0)) return null
  for (let i = 0; i < 300; i++) {
    const mid = low.plus(high).dividedBy(2)
    const fMid = npv(sorted, mid, start)
    if (fMid.abs().lt(tol) || high.minus(low).dividedBy(2).lt(tol)) {
      return mid.toDecimalPlaces(10).toString()
    }
    if (fMid.times(fLow).lt(0)) {
      high = mid
    } else {
      low = mid
      fLow = fMid
    }
  }
  return null
}

/**
 * Builds XIRR flows for a period: start value paid in at `from`, every external
 * flow in between, end value received at `to`.
 */
export function periodCashFlows(series: readonly ValuePoint[]): DatedCashFlow[] {
  if (series.length === 0) return []
  const first = series[0]!
  const last = series.at(-1)!
  const flows: DatedCashFlow[] = [{ date: first.date, amountCents: -first.valueCents }]
  for (let i = 1; i < series.length; i++) {
    const point = series[i]!
    if (point.flowCents !== 0) flows.push({ date: point.date, amountCents: -point.flowCents })
  }
  flows.push({ date: last.date, amountCents: last.valueCents })
  return flows
}

/** Real return: (1 + nominal) / (1 + inflation) − 1. */
export function realReturn(nominal: string | null, inflation: string): string | null {
  if (nominal === null) return null
  return new D(nominal)
    .plus(1)
    .dividedBy(new D(inflation).plus(1))
    .minus(1)
    .toDecimalPlaces(10)
    .toString()
}
