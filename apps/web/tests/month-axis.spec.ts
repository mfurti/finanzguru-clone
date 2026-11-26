import { describe, expect, it } from 'vitest'
import { monthAxis } from '~/utils/month-axis'

const months = (...from: string[]) => from.map((value) => ({ from: value }))

describe('monthAxis (007 T014)', () => {
  it('shows the year at the first bar and at January, with a divider at the change', () => {
    const axis = monthAxis(months('2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'))
    expect(axis.labels).toEqual(['Nov 2025', 'Dez', 'Jan 2026', 'Feb'])
    expect(axis.dividers).toEqual([1.5])
  })

  it('has no divider when January is the first bar', () => {
    expect(monthAxis(months('2026-01-01', '2026-02-01')).dividers).toEqual([])
  })

  it('labels quarters and years', () => {
    expect(monthAxis(months('2025-10-01', '2026-01-01'), 'quarter')).toEqual({
      labels: ['Q4 2025', 'Q1 2026'],
      dividers: [0.5],
    })
    expect(monthAxis(months('2025-01-01', '2026-01-01'), 'year')).toEqual({
      labels: ['2025', '2026'],
      dividers: [],
    })
  })
})
