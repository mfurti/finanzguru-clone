import { describe, expect, it } from 'vitest'
import {
  monthsFactor,
  vorabpauschale,
  type VorabpauschaleInput,
} from '../../src/domain/vorabpauschale'
import reference from '../fixtures/vorabpauschale-reference.json'

describe('Vorabpauschale (SC-004)', () => {
  for (const testCase of reference.cases) {
    it(`matches the hand calculation: ${testCase.name}`, () => {
      const result = vorabpauschale(testCase.input as VorabpauschaleInput)
      expect(result).toEqual({ ...testCase.expected, reason: null })
    })
  }

  it('reduces by 1/12 per full month before purchase', () => {
    expect(monthsFactor('2023-12-31', 2024).toString()).toBe('1')
    expect(monthsFactor('2024-01-20', 2024).toString()).toBe('1')
    expect(monthsFactor('2024-05-15', 2024).times(12).toString()).toBe('8')
    expect(monthsFactor('2024-12-01', 2024).times(12).toString()).toBe('1')
    expect(monthsFactor('2025-01-01', 2024).toString()).toBe('0')
  })

  it('never goes below zero when prices fell', () => {
    const base = reference.cases[0]!.input as VorabpauschaleInput
    expect(vorabpauschale({ ...base, endPrice: '90' })).toEqual({
      basisertragCents: 0,
      vorabpauschaleCents: 0,
      taxableCents: 0,
      reason: null,
    })
  })

  it('reports a missing base rate or price', () => {
    const base = reference.cases[0]!.input as VorabpauschaleInput
    expect(vorabpauschale({ ...base, baseRate: null }).reason).toBe('base_rate_missing')
    expect(vorabpauschale({ ...base, startPrice: null }).reason).toBe('price_missing')
  })
})
