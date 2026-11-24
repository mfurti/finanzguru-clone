import { describe, expect, it } from 'vitest'
import { trailingReturns } from '../../src/domain/period-returns'
import type { ValuePoint } from '../../src/domain/returns'

/** Daily series from `from` growing by a constant daily factor, one deposit at the start. */
function series(from: string, days: number, dailyGrowth: number): ValuePoint[] {
  const start = new Date(`${from}T00:00:00Z`)
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    return {
      date,
      valueCents: Math.round(100_000 * Math.pow(1 + dailyGrowth, i)),
      flowCents: i === 0 ? 100_000 : 0,
    }
  })
}

describe('trailing returns (003 US5)', () => {
  const inflation = () => '0.02'

  it('returns 1M … Gesamt ending today with IZF, inflation and real return', () => {
    const data = series('2024-01-01', 1059, 0.0003)
    const today = data.at(-1)!.date
    const rows = trailingReturns(data, inflation, today)
    expect(rows.map((r) => r.period)).toEqual(['1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'ALL'])
    const oneYear = rows.find((r) => r.period === '1Y')!
    // ~0.03 % per day ≈ 11.6 % p.a.
    expect(Number(oneYear.xirr)).toBeGreaterThan(0.11)
    expect(Number(oneYear.xirr)).toBeLessThan(0.12)
    expect(oneYear.inflation).toBe('0.02')
    expect(Number(oneYear.realReturn)).toBeCloseTo((1 + Number(oneYear.xirr)) / 1.02 - 1, 6)
    const month = rows.find((r) => r.period === '1M')!
    expect(Number(month.twror)).toBeCloseTo(Math.pow(1.0003, 30) - 1, 2)
  })

  it('starts longer periods at the first data point', () => {
    const data = series('2026-03-01', 200, 0.0001)
    const today = data.at(-1)!.date
    const rows = trailingReturns(data, inflation, today)
    expect(rows.find((r) => r.period === '5Y')!.from).toBe('2026-03-01')
    expect(rows.find((r) => r.period === 'ALL')!.from).toBe('2026-03-01')
    expect(rows.find((r) => r.period === 'YTD')!.from).toBe('2026-03-01')
  })

  it('returns nothing for fewer than two points', () => {
    expect(trailingReturns(series('2026-01-01', 1, 0), inflation, '2026-01-01')).toEqual([])
  })
})
