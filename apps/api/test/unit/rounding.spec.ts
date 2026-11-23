import { describe, expect, it } from 'vitest'
import { largestRemainder } from '../../src/domain/rounding'

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

describe('largestRemainder', () => {
  it('always adds up to the total', () => {
    for (const total of [0, 1, 99, 100, 101, 1_463_116]) {
      const parts = largestRemainder([1, 1, 1], total)
      expect(sum(parts)).toBe(total)
    }
  })

  it('splits proportionally', () => {
    expect(largestRemainder([60, 40], 1000)).toEqual([600, 400])
    expect(largestRemainder([0.6, 0.25, 0.15], 333)).toEqual([200, 83, 50])
  })

  it('gives remainders to the largest fractions, ties to the earlier index', () => {
    expect(largestRemainder([1, 1, 1], 100)).toEqual([34, 33, 33])
    expect(largestRemainder([1, 2], 10)).toEqual([3, 7])
  })

  it('handles empty input and zero weights', () => {
    expect(largestRemainder([], 100)).toEqual([])
    expect(largestRemainder([0, 0], 50)).toEqual([50, 0])
  })

  it('keeps negative totals consistent', () => {
    const parts = largestRemainder([1, 1, 1], -100)
    expect(sum(parts)).toBe(-100)
  })
})
