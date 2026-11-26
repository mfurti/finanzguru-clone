/**
 * Freistellungsauftrag usage (feature 002, research R8).
 * Taxable capital income per broker and year = gross dividends + gross interest
 * + realized gains − separate fee bookings. An order is used up to its amount.
 */
import { ALLOWANCE_CENTS, type Assessment } from '@finance/shared'

export interface IncomeParts {
  /** Net dividend bookings plus the tax withheld on them. */
  dividendsGrossCents: number
  interestGrossCents: number
  realizedGainsCents: number
  /** Separate fee bookings (positive amount). */
  feesCents: number
}

export function taxableIncome(parts: IncomeParts): number {
  return (
    parts.dividendsGrossCents +
    parts.interestGrossCents +
    parts.realizedGainsCents -
    parts.feesCents
  )
}

export function orderUsage(
  orderCents: number,
  incomeCents: number,
): { usedCents: number; remainingCents: number } {
  const usedCents = Math.min(orderCents, Math.max(0, incomeCents))
  return { usedCents, remainingCents: orderCents - usedCents }
}

export function allowanceCheck(
  assessment: Assessment,
  ordersCents: readonly number[],
): { allowanceCents: number; totalCents: number; exceedsAllowance: boolean } {
  const allowanceCents = ALLOWANCE_CENTS[assessment]
  const totalCents = ordersCents.reduce((sum, amount) => sum + amount, 0)
  return { allowanceCents, totalCents, exceedsAllowance: totalCents > allowanceCents }
}
