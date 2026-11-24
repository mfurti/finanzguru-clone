import { describe, expect, it } from 'vitest'
import { initials, maskIban, sparkline } from '../../src/domain/sparkline'

describe('sparkline (003 US2)', () => {
  it('keeps the last 30 values', () => {
    const values = Array.from({ length: 45 }, (_, i) => i)
    expect(sparkline(values)).toEqual(values.slice(15))
  })

  it('draws a flat line for fewer than two points', () => {
    expect(sparkline([500])).toEqual([500, 500])
    expect(sparkline([])).toEqual([0, 0])
  })
})

describe('maskIban', () => {
  it('shows country, check digits and the last four characters', () => {
    expect(maskIban('DE89 3704 0044 0532 0130 00')).toBe('DE89 •••• •••• 3000')
    expect(maskIban(null)).toBeNull()
  })
})

describe('initials', () => {
  it('takes two letters', () => {
    expect(initials('Demo Girokonto')).toBe('DG')
    expect(initials('Sparkasse')).toBe('SP')
    expect(initials('—')).toBe('?')
  })
})
