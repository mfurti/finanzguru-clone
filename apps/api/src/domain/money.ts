/**
 * Money arithmetic. Amounts are integer cents (EUR); quantities, prices and
 * rates are decimal strings. Rounding to cents is half-even (banker's rounding)
 * so repeated aggregation does not drift (research R6).
 */
import Decimal from 'decimal.js'

/** Isolated Decimal constructor; never touches the global configuration. */
export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN })
export type DecimalValue = InstanceType<typeof D>

export type DecimalInput = DecimalValue | string | number

/** Euros (decimal) to integer cents, half-even. `'12.345'` → `1234`, `'12.355'` → `1236`. */
export function eurosToCents(euros: DecimalInput): number {
  return new D(euros).times(100).toDecimalPlaces(0, D.ROUND_HALF_EVEN).toNumber()
}

/** Integer cents to a euro decimal. */
export function centsToEuros(cents: number): DecimalValue {
  return new D(cents).dividedBy(100)
}

/** Value of `quantity × unitPrice` (EUR) in cents, half-even. */
export function valueCents(quantity: DecimalInput, unitPrice: DecimalInput): number {
  return eurosToCents(new D(quantity).times(unitPrice))
}

/** Multiplies cents by a decimal factor and rounds half-even. */
export function mulCents(cents: number, factor: DecimalInput): number {
  return new D(cents).times(factor).toDecimalPlaces(0, D.ROUND_HALF_EVEN).toNumber()
}

/** Sum of cent amounts; throws on non-integers so float bugs surface early. */
export function sumCents(values: Iterable<number>): number {
  let total = 0
  for (const value of values) {
    if (!Number.isInteger(value)) throw new Error(`Not an integer cent amount: ${value}`)
    total += value
  }
  return total
}

/** `numerator / denominator` as a decimal string, or `null` if the denominator is 0. */
export function ratio(
  numerator: DecimalInput,
  denominator: DecimalInput,
  places = 10,
): string | null {
  const den = new D(denominator)
  if (den.isZero()) return null
  return new D(numerator).dividedBy(den).toDecimalPlaces(places).toString()
}

/** Normalizes a decimal string (`'1.50'` → `'1.5'`). */
export function normalizeDecimal(value: DecimalInput): string {
  return new D(value).toString()
}
