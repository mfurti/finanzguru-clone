import { describe, expect, it } from 'vitest'
import { compactEur } from '~/utils/compact-eur'

describe('compactEur (007 T011)', () => {
  it.each([
    [0, '0 €'],
    [85_000, '850 €'],
    [500_000, '5K €'],
    [250_000, '2,5K €'],
    [2_000_000, '20K €'],
    [123_456_00, '123,5K €'],
    [120_000_000, '1,2M €'],
    [-500_000, '-5K €'],
  ])('%i cents → %s', (cents, label) => {
    expect(compactEur(cents)).toBe(label)
  })
})
