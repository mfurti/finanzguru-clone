/**
 * Volatility per instrument (feature 002, research R3): annualized standard
 * deviation of daily log returns over the last 365 days, σ × √252.
 * Needs at least 60 closes; precision is not money-critical, so plain
 * floating point is used and the result is rounded to 6 places.
 */
import { addDays } from './period'

export const MIN_PRICE_POINTS = 60
const TRADING_DAYS = 252

export type VolatilityClass = 'low' | 'medium' | 'high' | 'unknown'

export function annualizedVolatility(
  closes: readonly { date: string; close: string }[],
  today: string,
): string | null {
  const from = addDays(today, -365)
  const recent = closes
    .filter((point) => point.date > from && point.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => Number(point.close))
    .filter((close) => close > 0)
  if (recent.length < MIN_PRICE_POINTS) return null

  const returns: number[] = []
  for (let i = 1; i < recent.length; i++) returns.push(Math.log(recent[i]! / recent[i - 1]!))
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1)
  return (Math.sqrt(variance) * Math.sqrt(TRADING_DAYS)).toFixed(6)
}

/** niedrig < 10 %, mittel 10–20 %, hoch > 20 %. */
export function volatilityClass(volatility: string | null): VolatilityClass {
  if (volatility === null) return 'unknown'
  const value = Number(volatility)
  if (value < 0.1) return 'low'
  if (value <= 0.2) return 'medium'
  return 'high'
}

export type ReturnClass = 'lt_m10' | 'm10_0' | 'p0_10' | 'p10_25' | 'gt_25'

/** Groups by unrealized gain: < −10 %, −10–0 %, 0–10 %, 10–25 %, > 25 %. */
export function returnClass(gainPct: string | null): ReturnClass {
  const value = gainPct === null ? 0 : Number(gainPct)
  if (value < -0.1) return 'lt_m10'
  if (value < 0) return 'm10_0'
  if (value < 0.1) return 'p0_10'
  if (value <= 0.25) return 'p10_25'
  return 'gt_25'
}
