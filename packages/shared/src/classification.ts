/**
 * Fixed key lists for instrument classification (feature 002, research R1).
 * Keys are stored in the database; labels are the German UI texts.
 */

/** Bucket for shares that are not assigned (weights summing to less than 100 %). */
export const UNASSIGNED_KEY = 'unassigned'
export const UNASSIGNED_LABEL = 'Nicht zugeordnet'

export const REGIONS = [
  'north_america',
  'europe',
  'japan',
  'pacific_ex_japan',
  'emerging_markets',
  'other',
] as const
export type Region = (typeof REGIONS)[number]

export const REGION_LABELS: Record<Region, string> = {
  north_america: 'Nordamerika',
  europe: 'Europa',
  japan: 'Japan',
  pacific_ex_japan: 'Pazifik ex Japan',
  emerging_markets: 'Schwellenländer',
  other: 'Sonstige',
}

/** The 11 GICS sectors. */
export const SECTORS = [
  'information_technology',
  'financials',
  'health_care',
  'consumer_discretionary',
  'industrials',
  'communication_services',
  'consumer_staples',
  'energy',
  'materials',
  'utilities',
  'real_estate',
] as const
export type Sector = (typeof SECTORS)[number]

export const SECTOR_LABELS: Record<Sector, string> = {
  information_technology: 'IT',
  financials: 'Finanzen',
  health_care: 'Gesundheit',
  consumer_discretionary: 'Zyklische Konsumgüter',
  industrials: 'Industrie',
  communication_services: 'Kommunikation',
  consumer_staples: 'Basiskonsumgüter',
  energy: 'Energie',
  materials: 'Rohstoffe',
  utilities: 'Versorger',
  real_estate: 'Immobilien',
}

export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
  'HKD',
  'INR',
  'KRW',
  'TWD',
  'SEK',
  'DKK',
  'NOK',
  'OTHER',
] as const
export type CurrencyKey = (typeof CURRENCIES)[number]

export const CURRENCY_LABELS: Record<CurrencyKey, string> = Object.fromEntries(
  CURRENCIES.map((code) => [code, code === 'OTHER' ? 'Sonstige' : code]),
) as Record<CurrencyKey, string>

export const WEIGHT_DIMENSIONS = ['region', 'sector', 'currency'] as const
export type WeightDimension = (typeof WEIGHT_DIMENSIONS)[number]

export const DIMENSION_KEYS: Record<WeightDimension, readonly string[]> = {
  region: REGIONS,
  sector: SECTORS,
  currency: CURRENCIES,
}

export const DIMENSION_LABELS: Record<WeightDimension, Record<string, string>> = {
  region: REGION_LABELS,
  sector: SECTOR_LABELS,
  currency: CURRENCY_LABELS,
}

/** Fund types for the partial exemption (Teilfreistellung, InvStG). */
export const FUND_TYPES = ['equity', 'mixed', 'other'] as const
export type FundType = (typeof FUND_TYPES)[number]

export const FUND_TYPE_LABELS: Record<FundType, string> = {
  equity: 'Aktienfonds',
  mixed: 'Mischfonds',
  other: 'Sonstiger Fonds',
}

/** Share of fund income that is tax-free (as decimal strings). */
export const PARTIAL_EXEMPTION: Record<FundType, string> = {
  equity: '0.3',
  mixed: '0.15',
  other: '0',
}

/** Breakdown dimensions of the Analyse page. */
export const BREAKDOWN_DIMENSIONS = [
  'assetClass',
  'region',
  'sector',
  'currency',
  'volatility',
  'return',
  'grouping',
] as const
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number]

export const VOLATILITY_CLASSES = ['low', 'medium', 'high', 'unknown'] as const
export const VOLATILITY_LABELS: Record<(typeof VOLATILITY_CLASSES)[number], string> = {
  low: 'Niedrig (< 10 %)',
  medium: 'Mittel (10–20 %)',
  high: 'Hoch (> 20 %)',
  unknown: 'Nicht berechenbar',
}

export const RETURN_CLASSES = ['lt_m10', 'm10_0', 'p0_10', 'p10_25', 'gt_25'] as const
export const RETURN_LABELS: Record<(typeof RETURN_CLASSES)[number], string> = {
  lt_m10: '< −10 %',
  m10_0: '−10 bis 0 %',
  p0_10: '0 bis 10 %',
  p10_25: '10 bis 25 %',
  gt_25: '> 25 %',
}

/** Saver's allowance (Sparerpauschbetrag) in cents by assessment type. */
export const ASSESSMENTS = ['single', 'joint'] as const
export type Assessment = (typeof ASSESSMENTS)[number]
export const ALLOWANCE_CENTS: Record<Assessment, number> = { single: 100_000, joint: 200_000 }

/** Allowlisted user setting keys. */
export const USER_SETTING_KEYS = [
  'chart.networth.benchmark',
  'chart.investments.benchmark',
] as const
export type UserSettingKey = (typeof USER_SETTING_KEYS)[number]
