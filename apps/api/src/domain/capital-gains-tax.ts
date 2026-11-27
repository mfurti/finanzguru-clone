/**
 * Capital-gains tax on a taxable amount (014 US3, EStG § 32d): Abgeltungsteuer 25 %, plus
 * Solidaritätszuschlag 5.5 % of it, plus church tax when the owner pays it. With church tax
 * the Abgeltungsteuer is reduced so the church tax is deductible: tax = amount / (4 + k),
 * k = church tax rate (8 % in Bavaria and Baden-Württemberg, 9 % elsewhere).
 * An estimate: the broker's statement is authoritative.
 */
import { D } from './money'

export interface CapitalGainsTax {
  capitalGainsTaxCents: number
  solidarityCents: number
  churchTaxCents: number
  totalCents: number
}

const cents = (value: InstanceType<typeof D>) =>
  value.toDecimalPlaces(0, D.ROUND_HALF_EVEN).toNumber()

export function capitalGainsTax(taxableCents: number, churchRate: string): CapitalGainsTax {
  if (taxableCents <= 0) {
    return { capitalGainsTaxCents: 0, solidarityCents: 0, churchTaxCents: 0, totalCents: 0 }
  }
  const church = new D(churchRate)
  const base = new D(taxableCents).dividedBy(new D(4).plus(church))
  const capitalGainsTaxCents = cents(base)
  const solidarityCents = cents(base.times('0.055'))
  const churchTaxCents = cents(base.times(church))
  return {
    capitalGainsTaxCents,
    solidarityCents,
    churchTaxCents,
    totalCents: capitalGainsTaxCents + solidarityCents + churchTaxCents,
  }
}
