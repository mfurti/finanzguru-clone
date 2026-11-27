import { describe, expect, it } from 'vitest'
import { BOOKING_COLUMN_DEFAULTS, initialColumnVisibility } from '~/utils/booking-columns'

const defaults = {
  date: true,
  category: true,
  tags: false,
  properties: true,
  amount: true,
  taxes: false,
}

describe('Transaktionen columns like the reference (012 T004)', () => {
  it('offers Datum, Kategorie, Tags, Eigenschaften, Betrag, Steuern; four of them on', () => {
    expect(BOOKING_COLUMN_DEFAULTS).toEqual(defaults)
    expect(initialColumnVisibility(null)).toEqual(defaults)
  })

  it('keeps a stored choice and drops the former Konto and Verwendungszweck columns', () => {
    expect(
      initialColumnVisibility('{"account":true,"purpose":true,"tags":true,"date":false}'),
    ).toEqual({ ...defaults, tags: true, date: false })
  })

  it('ignores unknown keys and non-boolean values', () => {
    expect(initialColumnVisibility('{"foo":true,"amount":"yes"}')).toEqual(defaults)
  })

  it('falls back to the defaults on broken storage', () => {
    expect(initialColumnVisibility('not json')).toEqual(defaults)
    expect(initialColumnVisibility('[1,2]')).toEqual(defaults)
  })
})
