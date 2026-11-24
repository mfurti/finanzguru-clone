import { describe, expect, it } from 'vitest'
import { budgetSeries, figures, ratio } from '../../src/domain/budget-history'

describe('budget history (003 US4)', () => {
  const lines = [
    { id: 'food', limitCents: 50000, createdMonth: '2026-01' },
    { id: 'home', limitCents: 90000, createdMonth: '2026-06' },
  ]
  const spent = (id: string, month: string) =>
    id === 'food' ? 40000 : month >= '2026-06' ? 95000 : 0

  it('leaves a gap before a budget existed and sums the total', () => {
    const series = budgetSeries(lines, ['2026-05', '2026-06'], spent)
    expect(series[0]!.byBudget.home).toEqual({ budgetCents: null, spentCents: 0 })
    expect(series[0]!.total).toEqual({ budgetCents: 50000, spentCents: 40000 })
    expect(series[1]!.total).toEqual({ budgetCents: 140000, spentCents: 135000 })
  })

  it('has no total budget before the first budget', () => {
    expect(budgetSeries(lines, ['2025-12'], () => 0)[0]!.total.budgetCents).toBeNull()
  })

  it('computes ratio and difference; overruns are negative', () => {
    expect(figures(90000, 95000)).toEqual({
      limitCents: 90000,
      spentCents: 95000,
      ratio: '1.0556',
      diffCents: -5000,
    })
    expect(ratio(100, 0)).toBe('0')
  })
})
