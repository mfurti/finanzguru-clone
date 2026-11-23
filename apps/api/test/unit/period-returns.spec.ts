import { describe, expect, it } from 'vitest'
import { eachDay } from '../../src/domain/period'
import { cumulativeTwror, monthlyReturns, yearlyReturns } from '../../src/domain/period-returns'
import { periodCashFlows, twror, type ValuePoint, xirr } from '../../src/domain/returns'

/** 1000 € on 2025-01-01, +1 % per month-end, one 500 € deposit on 2025-07-01. */
function demoSeries(): ValuePoint[] {
  let value = 100_000
  return eachDay('2025-01-01', '2026-03-31').map((date, i, all) => {
    let flow = 0
    if (date === '2025-07-01') {
      flow = 50_000
      value += flow
    }
    const next = all[i + 1]
    if (i > 0 && (!next || next.slice(0, 7) !== date.slice(0, 7))) value = Math.round(value * 1.01)
    return { date, valueCents: value, flowCents: flow }
  })
}

describe('period returns', () => {
  const series = demoSeries()

  it('gives each month its own TWROR, unaffected by deposits', () => {
    const months = monthlyReturns(series)
    expect(months[0]).toMatchObject({ year: 2025, month: 1 })
    for (const m of months) expect(Number(m.twror)).toBeCloseTo(0.01, 4)
  })

  it('chains months to the year and matches the TWROR of the whole year', () => {
    const years = yearlyReturns(series, () => '0.02', '2026-03-31')
    const y2025 = years.find((y) => y.year === 2025)!
    expect(Number(y2025.twror)).toBeCloseTo(1.01 ** 12 - 1, 4)
    expect(years.find((y) => y.year === 2026)!.ytd).toBe(true)
  })

  it('uses the same XIRR as the KPI card for a year', () => {
    const slice = series.filter((p) => p.date.startsWith('2025'))
    const y2025 = yearlyReturns(series, () => '0.02', '2026-03-31')[0]!
    expect(y2025.xirr).toBe(xirr(periodCashFlows(slice)))
    expect(Number(y2025.realReturn)).toBeCloseTo((1 + Number(y2025.xirr)) / 1.02 - 1, 8)
  })

  it('builds a cumulative series ending at the period TWROR', () => {
    const points = cumulativeTwror(series)
    expect(points[0]).toEqual({ date: '2025-01-01', twror: '0' })
    expect(Number(points.at(-1)!.twror)).toBeCloseTo(Number(twror(series)), 6)
  })
})
