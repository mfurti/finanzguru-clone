import { z } from 'zod'

/** Owner preferences (014). Every field has a default, so a fresh install needs no rows. */
export const START_PAGES = ['dashboard', 'transactions', 'budget'] as const
export const DEFAULT_PERIODS = ['1M', 'YTD', '1Y', '3Y', '5Y', 'MAX'] as const
export const COLOR_MODES = ['light', 'dark', 'system'] as const
export const DENSITIES = ['compact', 'normal'] as const
export const CHURCH_TAX_STATES = ['none', 'BY', 'BW', 'other'] as const
export const ROUNDINGS = ['cents', 'euros'] as const
export const REFRESH_MODES = ['off', 'daily', 'interval'] as const
export const AUTO_LOGOUT_MINUTES = [0, 15, 30, 60, 240] as const

export const refreshSchedule = z
  .object({
    mode: z.enum(REFRESH_MODES),
    /** Local time for `daily`, HH:MM. */
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    /** Interval for `interval`, 1–24 hours. */
    hours: z.number().int().min(1).max(24),
  })
  .strict()
export type RefreshSchedule = z.infer<typeof refreshSchedule>

export const ownerSettings = z
  .object({
    startPage: z.enum(START_PAGES),
    defaultPeriod: z.enum(DEFAULT_PERIODS),
    colorMode: z.enum(COLOR_MODES),
    privacyMode: z.boolean(),
    density: z.enum(DENSITIES),
    assessmentDefault: z.enum(['single', 'joint']),
    churchTax: z.enum(CHURCH_TAX_STATES),
    purchasesCountAsSaved: z.boolean(),
    /** Day of month a budget month starts on (1–28). */
    budgetMonthStart: z.number().int().min(1).max(28),
    rounding: z.enum(ROUNDINGS),
    refreshSchedule,
    /** Idle minutes before logout; 0 = off. */
    autoLogoutMinutes: z.literal(AUTO_LOGOUT_MINUTES),
    archivedInSums: z.boolean(),
  })
  .strict()
export type OwnerSettings = z.infer<typeof ownerSettings>

export const DEFAULT_OWNER_SETTINGS: OwnerSettings = {
  startPage: 'dashboard',
  defaultPeriod: '1Y',
  colorMode: 'system',
  privacyMode: false,
  density: 'normal',
  assessmentDefault: 'single',
  churchTax: 'none',
  purchasesCountAsSaved: true,
  budgetMonthStart: 1,
  rounding: 'cents',
  refreshSchedule: { mode: 'off', time: '06:00', hours: 6 },
  autoLogoutMinutes: 0,
  archivedInSums: false,
}

/** PATCH body: any subset of the settings. */
export const ownerSettingsPatch = ownerSettings.partial()
export type OwnerSettingsPatch = z.infer<typeof ownerSettingsPatch>

/** Church tax rate on the capital-gains tax: 8 % in Bavaria and Baden-Württemberg, else 9 %. */
export const churchTaxRate = (state: OwnerSettings['churchTax']): string =>
  state === 'none' ? '0' : state === 'BY' || state === 'BW' ? '0.08' : '0.09'
