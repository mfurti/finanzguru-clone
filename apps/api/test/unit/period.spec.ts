import { describe, expect, it } from 'vitest'
import {
  addMonths,
  daysBetween,
  eachDay,
  lastPeriods,
  periodBounds,
  resolvePeriod,
  resolveRange,
  shiftPeriod,
} from '../../src/domain/period'

describe('period helpers', () => {
  const today = '2026-11-23'

  it('resolves chart periods', () => {
    expect(resolvePeriod('1W', today)).toEqual({ from: '2026-11-16', to: today })
    expect(resolvePeriod('1M', today).from).toBe('2026-10-23')
    expect(resolvePeriod('YTD', today).from).toBe('2026-01-01')
    expect(resolvePeriod('1Y', today).from).toBe('2025-11-23')
    expect(resolvePeriod('3Y', today).from).toBe('2023-11-23')
    expect(resolvePeriod('5Y', today).from).toBe('2021-11-23')
  })

  it('starts no earlier than the first data date', () => {
    expect(resolvePeriod('5Y', today, '2025-03-01').from).toBe('2025-03-01')
    expect(resolvePeriod('ALL', today, '2024-01-15').from).toBe('2024-01-15')
  })

  it('lets from/to override the period', () => {
    expect(resolveRange({ period: '1Y', from: '2026-01-01', to: '2026-06-30' }, today)).toEqual({
      from: '2026-01-01',
      to: '2026-06-30',
    })
  })

  it('clamps month arithmetic to month ends', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29')
  })

  it('builds month, quarter and year bounds with German labels', () => {
    expect(periodBounds('month', today)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      label: 'November 2026',
    })
    expect(periodBounds('quarter', today)).toEqual({
      from: '2026-10-01',
      to: '2026-12-31',
      label: 'Q4 2026',
    })
    expect(periodBounds('year', '2024-02-29')).toEqual({
      from: '2024-01-01',
      to: '2024-12-31',
      label: '2024',
    })
  })

  it('steps periods back and forward', () => {
    expect(shiftPeriod('month', '2026-01-15', -1).label).toBe('Dezember 2025')
    expect(shiftPeriod('quarter', '2026-01-15', -1).label).toBe('Q4 2025')
    const twelve = lastPeriods('month', today, 12)
    expect(twelve).toHaveLength(12)
    expect(twelve[0]?.label).toBe('Dezember 2025')
    expect(twelve[11]?.label).toBe('November 2026')
  })

  it('lists and counts days', () => {
    expect(eachDay('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ])
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364)
  })
})
