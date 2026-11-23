import { describe, expect, it } from 'vitest'
import { allowanceCheck, orderUsage, taxableIncome } from '../../src/domain/exemption'

describe('exemption orders', () => {
  it('adds gross dividends, interest and realized gains, minus fee bookings', () => {
    expect(
      taxableIncome({
        dividendsGrossCents: 15_000,
        interestGrossCents: 2_000,
        realizedGainsCents: 5_000,
        feesCents: 1_000,
      }),
    ).toBe(21_000)
  })

  it('uses an order up to its amount and never below zero', () => {
    expect(orderUsage(80_000, 15_000)).toEqual({ usedCents: 15_000, remainingCents: 65_000 })
    expect(orderUsage(80_000, 120_000)).toEqual({ usedCents: 80_000, remainingCents: 0 })
    expect(orderUsage(80_000, -5_000)).toEqual({ usedCents: 0, remainingCents: 80_000 })
  })

  it('checks the total against the allowance by assessment', () => {
    expect(allowanceCheck('single', [80_000, 30_000])).toEqual({
      allowanceCents: 100_000,
      totalCents: 110_000,
      exceedsAllowance: true,
    })
    expect(allowanceCheck('joint', [80_000, 30_000]).exceedsAllowance).toBe(false)
  })
})
