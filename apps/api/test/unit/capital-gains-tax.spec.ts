import { describe, expect, it } from 'vitest'
import { capitalGainsTax } from '../../src/domain/capital-gains-tax'

describe('capitalGainsTax (014 T010)', () => {
  it('without church tax: 25 % plus 5.5 % solidarity surcharge = 26.375 %', () => {
    expect(capitalGainsTax(100_000, '0')).toEqual({
      capitalGainsTaxCents: 25_000,
      solidarityCents: 1_375,
      churchTaxCents: 0,
      totalCents: 26_375,
    })
  })

  it('church tax 8 % (BY/BW) lowers the Abgeltungsteuer: total ≈ 27.82 %', () => {
    const tax = capitalGainsTax(100_000, '0.08')
    expect(tax.capitalGainsTaxCents).toBe(24_510)
    expect(tax.solidarityCents).toBe(1_348)
    expect(tax.churchTaxCents).toBe(1_961)
    expect(tax.totalCents).toBe(27_819)
  })

  it('church tax 9 % (other states): total ≈ 28.0 %', () => {
    const tax = capitalGainsTax(100_000, '0.09')
    expect(tax.capitalGainsTaxCents).toBe(24_450)
    expect(tax.churchTaxCents).toBe(2_200)
    expect(tax.totalCents).toBe(27_995)
  })

  it('no tax on zero or negative amounts', () => {
    expect(capitalGainsTax(0, '0.09').totalCents).toBe(0)
    expect(capitalGainsTax(-500, '0').totalCents).toBe(0)
  })
})
