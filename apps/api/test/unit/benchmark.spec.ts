import { describe, expect, it } from 'vitest'
import { benchmarkSeries } from '../../src/domain/benchmark'

const prices = [
  { date: '2026-01-02', close: '100' },
  { date: '2026-01-05', close: '110' },
  { date: '2026-01-06', close: '99' },
]

describe('benchmarkSeries', () => {
  it('rebases to 0 % at the start and carries prices forward', () => {
    const result = benchmarkSeries(prices, { from: '2026-01-02', to: '2026-01-06' })
    expect(result.points).toEqual([
      { date: '2026-01-02', return: '0' },
      { date: '2026-01-03', return: '0' },
      { date: '2026-01-04', return: '0' },
      { date: '2026-01-05', return: '0.1' },
      { date: '2026-01-06', return: '-0.01' },
    ])
    expect(result.stale).toBe(false)
  })

  it('uses the last close before the period as the base', () => {
    const result = benchmarkSeries(prices, { from: '2026-01-04', to: '2026-01-05' })
    expect(result.points).toEqual([
      { date: '2026-01-04', return: '0' },
      { date: '2026-01-05', return: '0.1' },
    ])
  })

  it('starts at the first available price when the period begins earlier', () => {
    const result = benchmarkSeries(prices, { from: '2025-12-30', to: '2026-01-05' })
    expect(result.points[0]).toEqual({ date: '2026-01-02', return: '0' })
    expect(result.points.at(-1)).toEqual({ date: '2026-01-05', return: '0.1' })
  })

  it('marks prices older than 4 days as stale', () => {
    expect(benchmarkSeries(prices, { from: '2026-01-02', to: '2026-01-10' }).stale).toBe(false)
    expect(benchmarkSeries(prices, { from: '2026-01-02', to: '2026-01-11' }).stale).toBe(true)
    expect(benchmarkSeries([], { from: '2026-01-02', to: '2026-01-11' })).toEqual({
      points: [],
      stale: false,
    })
  })
})
