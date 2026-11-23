import { describe, expect, it } from 'vitest'
import {
  centsToEuros,
  eurosToCents,
  mulCents,
  normalizeDecimal,
  ratio,
  sumCents,
  valueCents,
} from '../../src/domain/money'

describe('money', () => {
  it('rounds euros to cents half-even', () => {
    expect(eurosToCents('12.345')).toBe(1234)
    expect(eurosToCents('12.355')).toBe(1236)
    expect(eurosToCents('-0.005')).toBe(-0)
    expect(eurosToCents('1856.45')).toBe(185645)
  })

  it('computes quantity × price without float drift', () => {
    expect(valueCents('13.26', '122.14')).toBe(161958)
    expect(valueCents('0.1', '0.2')).toBe(2)
    expect(valueCents('3', '0.1')).toBe(30)
  })

  it('multiplies cents by factors', () => {
    expect(mulCents(2362, 12)).toBe(28344)
    expect(mulCents(1000, '0.025')).toBe(25)
  })

  it('sums only integer cents', () => {
    expect(sumCents([164401, -177824])).toBe(-13423)
    expect(() => sumCents([1.5])).toThrow(/integer/)
  })

  it('returns null ratios for zero denominators', () => {
    expect(ratio(122, 1466.99, 4)).toBe('0.0832')
    expect(ratio(1, 0)).toBeNull()
  })

  it('converts and normalizes decimals', () => {
    expect(centsToEuros(185645).toString()).toBe('1856.45')
    expect(normalizeDecimal('1.50')).toBe('1.5')
  })
})
