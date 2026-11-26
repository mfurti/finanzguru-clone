/** DTOs for security search, quotes and price history (005 US4). */
import { z } from 'zod'
import { ASSET_CLASSES } from '../enums.js'
import { decimalString, isoDate } from './common.js'

/** `GET /api/market-data/search` query; at least 2 characters. */
export const securitySearchQuery = z.object({
  q: z.string().trim().min(2).max(100),
  class: z.enum(ASSET_CLASSES).optional(),
})
export type SecuritySearchQuery = z.infer<typeof securitySearchQuery>

export const securityHit = z.object({
  isin: z.string().length(12),
  wkn: z.string().nullable(),
  name: z.string(),
  assetClass: z.enum(ASSET_CLASSES),
})
export type SecurityHit = z.infer<typeof securityHit>

/** Results grouped by class, at most 10 per group; `more` when the group was cut. */
export const securitySearchResponse = z.object({
  available: z.boolean(),
  groups: z.array(
    z.object({
      assetClass: z.enum(ASSET_CLASSES),
      hits: z.array(securityHit),
      more: z.boolean(),
    }),
  ),
})
export type SecuritySearchResponse = z.infer<typeof securitySearchResponse>

/** Latest quote; prices are decimal strings in EUR. */
export const quoteDto = z.object({
  instrumentId: z.string(),
  price: decimalString,
  changeAbs: decimalString.nullable(),
  changePct: decimalString.nullable(),
  quotedAt: z.string(),
})
export type QuoteDto = z.infer<typeof quoteDto>

/** Scalable's chart has no 5-year timeframe; `MAX` is the full history (005 T024). */
export const CHART_RANGES = ['1M', '6M', '1Y', 'MAX'] as const
export type ChartRange = (typeof CHART_RANGES)[number]

export const chartQuery = z.object({ range: z.enum(CHART_RANGES).default('1M') })

export const chartPoint = z.object({ date: isoDate, close: decimalString })
export type ChartPoint = z.infer<typeof chartPoint>
