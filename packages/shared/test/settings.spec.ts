import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OWNER_SETTINGS,
  churchTaxRate,
  ownerSettings,
  ownerSettingsPatch,
} from '../src/index'

describe('owner settings (014)', () => {
  it('defaults are a valid settings object', () => {
    expect(ownerSettings.parse(DEFAULT_OWNER_SETTINGS)).toEqual(DEFAULT_OWNER_SETTINGS)
  })

  it('accepts a partial patch and rejects bad values and unknown keys', () => {
    expect(ownerSettingsPatch.parse({ density: 'compact' })).toEqual({ density: 'compact' })
    expect(ownerSettingsPatch.safeParse({ budgetMonthStart: 29 }).success).toBe(false)
    expect(ownerSettingsPatch.safeParse({ budgetMonthStart: 0 }).success).toBe(false)
    expect(ownerSettingsPatch.safeParse({ autoLogoutMinutes: 20 }).success).toBe(false)
    expect(ownerSettingsPatch.safeParse({ autoLogoutMinutes: 15 }).success).toBe(true)
    expect(
      ownerSettingsPatch.safeParse({ refreshSchedule: { mode: 'daily', time: '24:00', hours: 1 } })
        .success,
    ).toBe(false)
    expect(ownerSettingsPatch.safeParse({ unknown: true }).success).toBe(false)
  })

  it('church tax is 8 % in BY/BW, 9 % elsewhere, 0 when off', () => {
    expect(churchTaxRate('none')).toBe('0')
    expect(churchTaxRate('BY')).toBe('0.08')
    expect(churchTaxRate('BW')).toBe('0.08')
    expect(churchTaxRate('other')).toBe('0.09')
  })
})
