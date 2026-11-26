import { z } from 'zod'
import { ASSET_CLASSES } from '../enums.js'
import {
  BREAKDOWN_DIMENSIONS,
  CURRENCIES,
  FUND_TYPES,
  REGIONS,
  SECTORS,
} from '../classification.js'
import { accountsParam, cents, decimalString, isoDate, nullableRate, period } from './common.js'

/** Weight as decimal string, 0 < w <= 1. */
export const weight = decimalString.refine((v) => Number(v) > 0 && Number(v) <= 1, {
  message: 'Gewicht muss zwischen 0 und 100 % liegen',
})

const weightRows = <T extends readonly [string, ...string[]]>(keys: T) =>
  z
    .array(z.object({ key: z.enum(keys), weight }))
    .max(keys.length)
    .refine((rows) => new Set(rows.map((r) => r.key)).size === rows.length, {
      message: 'Jeder Eintrag nur einmal',
    })

export const classificationDto = z.object({
  fundType: z.enum(FUND_TYPES).nullable(),
  isBenchmark: z.boolean(),
  weights: z.object({
    region: weightRows(REGIONS),
    sector: weightRows(SECTORS),
    currency: weightRows(CURRENCIES),
  }),
})
export type ClassificationDto = z.infer<typeof classificationDto>

export const breakdownQuery = z.object({
  dimension: z.enum(BREAKDOWN_DIMENSIONS).default('assetClass'),
  groupingId: z.string().optional(),
  accounts: accountsParam,
})
export type BreakdownQuery = z.infer<typeof breakdownQuery>

export const breakdownBucket = z.object({
  key: z.string(),
  label: z.string(),
  valueCents: cents,
  pct: nullableRate,
  count: z.number().int(),
})
export type BreakdownBucket = z.infer<typeof breakdownBucket>

export const breakdownResponse = z.object({
  totalCents: cents,
  buckets: z.array(breakdownBucket),
})
export type BreakdownResponse = z.infer<typeof breakdownResponse>

export const returnsQuery = z.object({ accounts: accountsParam, period: period.default('ALL') })

export const yearlyReturn = z.object({
  year: z.number().int(),
  twror: nullableRate,
  xirr: nullableRate,
  inflation: decimalString,
  realReturn: nullableRate,
  ytd: z.boolean(),
})
export type YearlyReturn = z.infer<typeof yearlyReturn>

/** Trailing periods of the Wertentwicklung "Zeiträume" view (003 US5, FR-015). */
export const TRAILING_PERIODS = ['1M', '3M', 'YTD', '1Y', '3Y', '5Y', 'ALL'] as const
export type TrailingPeriod = (typeof TRAILING_PERIODS)[number]
export const trailingReturn = z.object({
  period: z.enum(TRAILING_PERIODS),
  from: isoDate,
  twror: nullableRate,
  /** IZF p.a. over the period. */
  xirr: nullableRate,
  /** Average yearly inflation over the period. */
  inflation: decimalString,
  realReturn: nullableRate,
})
export type TrailingReturn = z.infer<typeof trailingReturn>

export const returnsResponse = z.object({
  series: z.array(z.object({ date: isoDate, twror: decimalString })),
  months: z.array(
    z.object({ year: z.number().int(), month: z.number().int(), twror: nullableRate }),
  ),
  years: z.array(yearlyReturn),
  trailing: z.array(trailingReturn),
})
export type ReturnsResponse = z.infer<typeof returnsResponse>

export const compareQuery = z.object({ accounts: accountsParam, period: period.default('1Y') })
export const compareResponse = z.object({
  series: z.array(
    z.object({
      accountId: z.string(),
      name: z.string(),
      points: z.array(z.object({ date: isoDate, twror: decimalString })),
    }),
  ),
})
export type CompareResponse = z.infer<typeof compareResponse>

const name60 = z.string().trim().min(1).max(60)

export const groupingInput = z.object({
  name: name60,
  groups: z
    .array(name60)
    .min(1)
    .max(30)
    .refine((names) => new Set(names).size === names.length, {
      message: 'Gruppennamen müssen eindeutig sein',
    }),
})
export type GroupingInput = z.infer<typeof groupingInput>

export const groupingDto = z.object({
  id: z.string(),
  name: z.string(),
  groups: z.array(z.object({ id: z.string(), name: z.string() })),
  members: z.array(z.object({ instrumentId: z.string(), groupId: z.string() })),
})
export type GroupingDto = z.infer<typeof groupingDto>

export const groupingMembersInput = z.object({
  members: z.array(z.object({ instrumentId: z.string(), groupId: z.string().nullable() })),
})
export type GroupingMembersInput = z.infer<typeof groupingMembersInput>

export const inflationRates = z
  .array(
    z.object({
      year: z.number().int().min(1990).max(2100),
      rate: decimalString.refine((v) => Number(v) >= -0.1 && Number(v) <= 0.5, {
        message: 'Inflation zwischen −10 % und 50 %',
      }),
    }),
  )
  .refine((rows) => new Set(rows.map((r) => r.year)).size === rows.length, {
    message: 'Jedes Jahr nur einmal',
  })
export type InflationRates = z.infer<typeof inflationRates>

export const instrumentInput = z.object({
  isin: z.string().trim().toUpperCase().length(12),
  name: z.string().trim().min(1).max(200),
  assetClass: z.enum(ASSET_CLASSES).default('etf'),
  isBenchmark: z.boolean().default(false),
})
export type InstrumentInput = z.infer<typeof instrumentInput>

export const pricesInput = z.object({
  prices: z
    .array(
      z.object({
        date: isoDate,
        close: decimalString.refine((v) => Number(v) > 0, { message: 'Kurs muss > 0 sein' }),
      }),
    )
    .min(1)
    .max(20_000),
})
export type PricesInput = z.infer<typeof pricesInput>
