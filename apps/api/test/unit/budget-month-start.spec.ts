import { describe, expect, it } from 'vitest'
import { lastPeriods, periodBounds, shiftPeriod } from '../../src/domain/period'

describe('budget month start (014 T011)', () => {
  it('start 25: November covers 25.10.–24.11.', () => {
    expect(periodBounds('month', '2026-11-10', 25)).toEqual({
      from: '2026-10-25',
      to: '2026-11-24',
      label: 'November 2026',
    })
    expect(periodBounds('month', '2026-10-25', 25).label).toMatch(/^November 2026/)
  })

  it('a date on or after the start day belongs to the next month', () => {
    expect(periodBounds('month', '2026-11-25', 25)).toMatchObject({
      from: '2026-11-25',
      to: '2026-12-24',
    })
    expect(periodBounds('month', '2026-12-27', 25)).toMatchObject({
      from: '2026-12-25',
      to: '2027-01-24',
      label: 'Januar 2027',
    })
  })

  it('quarters and years shift the same way', () => {
    expect(periodBounds('quarter', '2026-11-10', 25)).toMatchObject({
      from: '2026-09-25',
      to: '2026-12-24',
    })
    expect(periodBounds('year', '2026-06-01', 25)).toMatchObject({
      from: '2025-12-25',
      to: '2026-12-24',
    })
  })

  it('consecutive periods touch without gaps or overlaps', () => {
    const months = lastPeriods('month', '2026-03-10', 4, 25)
    expect(months.map((m) => [m.from, m.to])).toEqual([
      ['2025-11-25', '2025-12-24'],
      ['2025-12-25', '2026-01-24'],
      ['2026-01-25', '2026-02-24'],
      ['2026-02-25', '2026-03-24'],
    ])
    expect(shiftPeriod('quarter', '2026-11-10', 1, 25)).toMatchObject({
      from: '2026-12-25',
      to: '2027-03-24',
    })
  })

  it('start 1 keeps calendar periods', () => {
    expect(periodBounds('month', '2026-11-30', 1)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      label: 'November 2026',
    })
    expect(shiftPeriod('year', '2026-06-01', -1)).toMatchObject({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })
})
