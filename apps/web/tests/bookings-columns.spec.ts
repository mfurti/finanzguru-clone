import { describe, expect, it } from 'vitest'
import { initialColumnVisibility } from '~/utils/booking-columns'

describe('Transaktionen columns (007 T004)', () => {
  it('hides Konto and Verwendungszweck by default', () => {
    expect(initialColumnVisibility(null)).toEqual({ account: false, purpose: false })
  })

  it('keeps an explicit choice and other stored columns', () => {
    expect(initialColumnVisibility('{"account":true,"tags":false}')).toEqual({
      account: true,
      purpose: false,
      tags: false,
    })
  })

  it('falls back to the defaults on broken storage', () => {
    expect(initialColumnVisibility('not json')).toEqual({ account: false, purpose: false })
    expect(initialColumnVisibility('[1,2]')).toEqual({ account: false, purpose: false })
  })
})
