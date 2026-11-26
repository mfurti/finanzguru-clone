import { describe, expect, it } from 'vitest'
import { addDays } from '../../src/domain/period'
import {
  annualizedVolatility,
  MIN_PRICE_POINTS,
  returnClass,
  volatilityClass,
} from '../../src/domain/volatility'

const today = '2026-11-20'

function series(n: number, next: (i: number, previous: number) => number) {
  const points: { date: string; close: string }[] = []
  let close = 100
  for (let i = 0; i < n; i++) {
    close = i === 0 ? close : next(i, close)
    points.push({ date: addDays(today, -(n - 1 - i)), close: close.toFixed(4) })
  }
  return points
}

describe('annualizedVolatility', () => {
  it('is zero for a constant growth rate', () => {
    // Closes are rounded to 4 places, so a tiny residual remains.
    expect(
      Number(
        annualizedVolatility(
          series(100, (_, p) => p * 1.001),
          today,
        ),
      ),
    ).toBeCloseTo(0, 4)
  })

  it('equals σ × √252 of daily log returns', () => {
    // Alternating ±1 % moves: 100 log returns of ±ln(1.01); sample σ = ln(1.01)·√(100/99).
    const points = series(101, (i, p) => (i % 2 ? p * 1.01 : p / 1.01))
    const expected = Math.log(1.01) * Math.sqrt(100 / 99) * Math.sqrt(252)
    expect(Number(annualizedVolatility(points, today))).toBeCloseTo(expected, 3)
  })

  it('needs at least 60 closes inside the last 365 days', () => {
    expect(
      annualizedVolatility(
        series(MIN_PRICE_POINTS - 1, (_, p) => p * 1.01),
        today,
      ),
    ).toBeNull()
    const old = series(80, (_, p) => p * 1.01).map((point) => ({
      ...point,
      date: addDays(point.date, -400),
    }))
    expect(annualizedVolatility(old, today)).toBeNull()
  })
})

describe('classes', () => {
  it('maps volatility to niedrig/mittel/hoch', () => {
    expect(volatilityClass(null)).toBe('unknown')
    expect(volatilityClass('0.0999')).toBe('low')
    expect(volatilityClass('0.1')).toBe('medium')
    expect(volatilityClass('0.2')).toBe('medium')
    expect(volatilityClass('0.2001')).toBe('high')
  })

  it('maps gains to return classes', () => {
    expect(returnClass('-0.2')).toBe('lt_m10')
    expect(returnClass('-0.05')).toBe('m10_0')
    expect(returnClass(null)).toBe('p0_10')
    expect(returnClass('0.15')).toBe('p10_25')
    expect(returnClass('0.3')).toBe('gt_25')
  })
})
