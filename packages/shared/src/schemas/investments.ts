import { z } from 'zod'
import { ASSET_CLASSES } from '../enums.js'
import { accountsParam, cents, decimalString, isoDate, nullableRate, period } from './common.js'

export const performanceQuery = z.object({
  accounts: accountsParam,
  period: period.default('1Y'),
  from: isoDate.optional(),
  to: isoDate.optional(),
})

export const performanceResponse = z.object({
  valueCents: cents,
  gainCents: cents,
  gainPct: nullableRate,
  series: z.array(z.object({ date: isoDate, valueCents: cents, investedCents: cents })),
})
export type PerformanceResponse = z.infer<typeof performanceResponse>

export const positionsQuery = z.object({
  accounts: accountsParam,
  assetClass: z.enum(ASSET_CLASSES).optional(),
  status: z.enum(['open', 'sold']).default('open'),
})
export type PositionsQuery = z.infer<typeof positionsQuery>

export const positionDto = z.object({
  instrumentId: z.string(),
  name: z.string(),
  assetClass: z.enum(ASSET_CLASSES),
  wkn: z.string().nullable(),
  isin: z.string(),
  priceCents: cents,
  dayChangePct: nullableRate,
  quantity: decimalString,
  valueCents: cents,
  entryValueCents: cents,
  avgPrice: decimalString.nullable(),
  gainCents: cents,
  gainPct: nullableRate,
  allocationPct: nullableRate,
  dividendsCents: cents,
  /** Sold positions only: realized result (gross). */
  realizedCents: cents.optional(),
})
export type PositionDto = z.infer<typeof positionDto>

export const assetClassDto = z.object({
  assetClass: z.enum(ASSET_CLASSES),
  valueCents: cents,
  pct: nullableRate,
  count: z.number().int(),
})
export type AssetClassDto = z.infer<typeof assetClassDto>
