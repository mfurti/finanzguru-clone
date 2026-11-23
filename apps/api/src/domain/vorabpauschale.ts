/**
 * Vorabpauschale estimate per fund position and year (feature 002, research R9,
 * InvStG § 18). An estimate only; the broker's statement is authoritative.
 *
 * 1. Basisertrag = units × price at the start of the year × Basiszins × 0.7;
 *    units bought during the year count 1/12 less per full month before purchase.
 * 2. Capped at the actual gain: (end − start price) × units + distributions, min 0.
 * 3. Vorabpauschale = max(0, Basisertrag − distributions).
 * 4. Taxable = Vorabpauschale × (1 − Teilfreistellung).
 */
import { type FundType, PARTIAL_EXEMPTION } from '@finance/shared'
import { D } from './money'

const FACTOR = '0.7'

export interface VorabpauschaleInput {
  year: number
  baseRate: string | null
  fundType: FundType
  /** Close at the last trading day of the previous year (or the first known price). */
  startPrice: string | null
  /** Close at the last trading day of the year (latest price for the current year). */
  endPrice: string | null
  /** Lots held at the end of the year. */
  lots: readonly { quantity: string; openDate: string }[]
  /** Distributions of the year in cents (net of nothing; as booked). */
  distributionsCents: number
}

export interface VorabpauschaleResult {
  basisertragCents: number
  vorabpauschaleCents: number
  taxableCents: number
  reason: 'base_rate_missing' | 'price_missing' | null
}

const ZERO: Omit<VorabpauschaleResult, 'reason'> = {
  basisertragCents: 0,
  vorabpauschaleCents: 0,
  taxableCents: 0,
}

/** Twelfths that count for a lot: 12 before the year, else 12 − full months before purchase. */
export function monthsFactor(openDate: string, year: number): InstanceType<typeof D> {
  const openYear = Number(openDate.slice(0, 4))
  if (openYear < year) return new D(1)
  if (openYear > year) return new D(0)
  const month = Number(openDate.slice(5, 7))
  return new D(13 - month).dividedBy(12)
}

const cents = (euros: InstanceType<typeof D>) =>
  euros.times(100).toDecimalPlaces(0, D.ROUND_HALF_EVEN).toNumber()

export function vorabpauschale(input: VorabpauschaleInput): VorabpauschaleResult {
  if (input.baseRate === null) return { ...ZERO, reason: 'base_rate_missing' }
  if (input.startPrice === null || input.endPrice === null)
    return { ...ZERO, reason: 'price_missing' }

  const start = new D(input.startPrice)
  const units = input.lots.reduce((sum, lot) => sum.plus(lot.quantity), new D(0))
  const weightedUnits = input.lots.reduce(
    (sum, lot) => sum.plus(new D(lot.quantity).times(monthsFactor(lot.openDate, input.year))),
    new D(0),
  )
  const basis = cents(weightedUnits.times(start).times(input.baseRate).times(FACTOR))
  const gain = cents(new D(input.endPrice).minus(start).times(units)) + input.distributionsCents
  const basisertragCents = Math.max(0, Math.min(basis, gain))
  const vorabpauschaleCents = Math.max(0, basisertragCents - input.distributionsCents)
  const exemption = new D(PARTIAL_EXEMPTION[input.fundType])
  const taxableCents = new D(vorabpauschaleCents)
    .times(new D(1).minus(exemption))
    .toDecimalPlaces(0, D.ROUND_HALF_EVEN)
    .toNumber()
  return { basisertragCents, vorabpauschaleCents, taxableCents, reason: null }
}
