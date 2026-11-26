import { UNASSIGNED_KEY } from '@finance/shared'
import { describe, expect, it } from 'vitest'
import { groupedBreakdown, weightedBreakdown } from '../../src/domain/breakdown'

const sum = (buckets: { valueCents: number }[]) => buckets.reduce((a, b) => a + b.valueCents, 0)

describe('weightedBreakdown', () => {
  it('splits by weights and puts the remainder into "Nicht zugeordnet"', () => {
    const buckets = weightedBreakdown([
      {
        instrumentId: 'world',
        valueCents: 100_000,
        weights: [
          { key: 'north_america', weight: '0.6' },
          { key: 'europe', weight: '0.15' },
        ],
      },
      {
        instrumentId: 'apple',
        valueCents: 50_000,
        weights: [{ key: 'north_america', weight: '1' }],
      },
      { instrumentId: 'bond', valueCents: 10_001, weights: [] },
    ])
    expect(buckets).toEqual([
      { key: 'north_america', valueCents: 110_000, count: 2 },
      { key: 'europe', valueCents: 15_000, count: 1 },
      { key: UNASSIGNED_KEY, valueCents: 35_001, count: 2 },
    ])
    expect(sum(buckets)).toBe(160_001)
  })

  it('adds up to the total to the cent with odd weights', () => {
    const holdings = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      instrumentId: String(n),
      valueCents: 123_457 * n,
      weights: [
        { key: 'a', weight: '0.333' },
        { key: 'b', weight: '0.333' },
        { key: 'c', weight: '0.333' },
      ],
    }))
    const total = holdings.reduce((a, h) => a + h.valueCents, 0)
    expect(sum(weightedBreakdown(holdings))).toBe(total)
  })

  it('returns nothing for an empty portfolio', () => {
    expect(weightedBreakdown([])).toEqual([])
  })
})

describe('groupedBreakdown', () => {
  it('assigns each holding to one bucket', () => {
    expect(
      groupedBreakdown([
        { valueCents: 300, key: 'etf' },
        { valueCents: 200, key: 'stock' },
        { valueCents: 100, key: 'etf' },
        { valueCents: 50, key: null },
      ]),
    ).toEqual([
      { key: 'etf', valueCents: 400, count: 2 },
      { key: 'stock', valueCents: 200, count: 1 },
      { key: UNASSIGNED_KEY, valueCents: 50, count: 1 },
    ])
  })
})
