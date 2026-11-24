/** DTOs for dividends, taxes, benchmarks and watchlists (feature 002). */
import { z } from 'zod'
import { ASSESSMENTS, FUND_TYPES } from '../classification.js'
import { accountsParam, cents, decimalString, isoDate, nullableRate, period } from './common.js'

// Dividenden (US2)

const dividendBucket = z.object({ key: z.string(), label: z.string(), cents, pct: nullableRate })

export const dividendSummary = z.object({
  last12Cents: cents,
  avgPerMonthCents: cents,
  ytdCents: cents,
  yieldYtd: nullableRate,
  cagr: nullableRate,
  years: z.array(z.object({ year: z.number().int(), cents, changePct: nullableRate })),
  bySecurity: z.array(
    z.object({ instrumentId: z.string(), name: z.string(), cents, pct: nullableRate }),
  ),
  /** Split by the instruments' region/sector weights (003 US5, FR-016); sums to the total. */
  byRegion: z.array(dividendBucket),
  bySector: z.array(dividendBucket),
})
export type DividendSummary = z.infer<typeof dividendSummary>

export const dividendCalendarQuery = z.object({
  accounts: accountsParam,
  from: isoDate.optional(),
  to: isoDate.optional(),
})

export const dividendCalendarEntry = z.object({
  id: z.string().nullable(),
  date: isoDate,
  instrumentId: z.string(),
  name: z.string(),
  status: z.enum(['expected', 'received']),
  cents,
  amountPerShare: decimalString.nullable(),
  exDate: isoDate.nullable(),
  note: z.string().nullable(),
})
export type DividendCalendarEntry = z.infer<typeof dividendCalendarEntry>

export const expectedDividendInput = z
  .object({
    instrumentId: z.string().min(1),
    payDate: isoDate,
    exDate: isoDate.nullable().optional(),
    amountPerShare: decimalString.refine((v) => Number(v) > 0, {
      message: 'Betrag je Anteil muss > 0 sein',
    }),
    note: z.string().max(200).nullable().optional(),
  })
  .refine((v) => !v.exDate || v.exDate <= v.payDate, {
    message: 'Ex-Tag muss vor dem Zahltag liegen',
    path: ['exDate'],
  })
export type ExpectedDividendInput = z.infer<typeof expectedDividendInput>

// Steuern (US4)

export const taxYearInput = z.object({
  assessment: z.enum(ASSESSMENTS),
  baseRate: decimalString
    .refine((v) => Number(v) >= 0 && Number(v) <= 0.2, { message: 'Basiszins 0 bis 20 %' })
    .nullable()
    .optional(),
})
export type TaxYearInput = z.infer<typeof taxYearInput>

export const exemptionOrderInput = z.object({
  institutionId: z.string().min(1),
  amountCents: z.number().int().min(0).max(10_000_000),
})
export type ExemptionOrderInput = z.infer<typeof exemptionOrderInput>

export const exemptionOrderDto = z.object({
  id: z.string(),
  institutionId: z.string(),
  institutionName: z.string(),
  amountCents: cents,
  usedCents: cents,
  remainingCents: cents,
  taxableIncomeCents: cents,
})
export type ExemptionOrderDto = z.infer<typeof exemptionOrderDto>

export const taxYearDto = z.object({
  year: z.number().int(),
  assessment: z.enum(ASSESSMENTS),
  allowanceCents: cents,
  baseRate: decimalString.nullable(),
  orders: z.array(exemptionOrderDto),
  totalCents: cents,
  usedCents: cents,
  exceedsAllowance: z.boolean(),
})
export type TaxYearDto = z.infer<typeof taxYearDto>

export const vorabpauschaleRow = z.object({
  instrumentId: z.string(),
  /** Depot and its institution (broker) holding the fund (003 FR-017). */
  accountId: z.string(),
  broker: z.string(),
  name: z.string(),
  fundType: z.enum(FUND_TYPES),
  basisertragCents: cents,
  vorabpauschaleCents: cents,
  taxableCents: cents,
  reason: z.enum(['base_rate_missing', 'price_missing']).nullable(),
})
export type VorabpauschaleRow = z.infer<typeof vorabpauschaleRow>

export const vorabpauschaleResponse = z.object({
  year: z.number().int(),
  baseRate: decimalString.nullable(),
  rows: z.array(vorabpauschaleRow),
  /** Rows grouped per broker with a subtotal, brokers sorted by name. */
  brokers: z.array(
    z.object({ broker: z.string(), rows: z.array(vorabpauschaleRow), subtotalCents: cents }),
  ),
  totalTaxableCents: cents,
  estimate: z.literal(true),
})
export type VorabpauschaleResponse = z.infer<typeof vorabpauschaleResponse>

// Vergleichen mit (US5)

export const benchmarkDto = z.object({
  instrumentId: z.string(),
  name: z.string(),
  isin: z.string(),
  firstDate: isoDate.nullable(),
  lastDate: isoDate.nullable(),
})
export type BenchmarkDto = z.infer<typeof benchmarkDto>

export const benchmarkSeriesQuery = z.object({
  period: period.default('1Y'),
  from: isoDate.optional(),
  to: isoDate.optional(),
})

export const benchmarkSeries = z.object({
  points: z.array(z.object({ date: isoDate, return: decimalString })),
  stale: z.boolean(),
})
export type BenchmarkSeries = z.infer<typeof benchmarkSeries>

export const chartSettings = z.object({
  networthBenchmark: z.string().nullable(),
  investmentsBenchmark: z.string().nullable(),
  /** "Investiertes Kapital" line in the net-worth chart (003 US6, FR-010); omitted = unchanged. */
  networthShowInvested: z.boolean().optional(),
})
export type ChartSettings = z.infer<typeof chartSettings>

// Watchlists (US6)

export const watchlistInput = z.object({ name: z.string().trim().min(1).max(60) })
export type WatchlistInput = z.infer<typeof watchlistInput>

export const watchlistSummary = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().int(),
})
export type WatchlistSummary = z.infer<typeof watchlistSummary>

export const watchlistEntryInput = z.object({
  isin: z.string().trim().toUpperCase().length(12),
  name: z.string().trim().min(1).max(200),
})
export type WatchlistEntryInput = z.infer<typeof watchlistEntryInput>

export const watchlistEntryDto = z.object({
  instrumentId: z.string(),
  name: z.string(),
  isin: z.string(),
  priceCents: cents.nullable(),
  priceDate: isoDate.nullable(),
  changeCents: cents.nullable(),
  changePct: nullableRate,
  stale: z.boolean(),
  hasPrices: z.boolean(),
})
export type WatchlistEntryDto = z.infer<typeof watchlistEntryDto>

export const watchlistDto = z.object({
  id: z.string(),
  name: z.string(),
  entries: z.array(watchlistEntryDto),
})
export type WatchlistDto = z.infer<typeof watchlistDto>
