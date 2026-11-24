import { z } from 'zod'
import { ASSET_CLASSES } from '../enums.js'
import { accountsParam, cents, decimalString, isoDate, nullableRate, period } from './common.js'

export const performanceQuery = z.object({
  accounts: accountsParam,
  /** Only instruments of this asset class (004 US2). */
  assetClass: z.enum(ASSET_CLASSES).optional(),
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

/** Columns of the positions table / CSV export (US4). */
export const POSITION_COLUMNS = [
  'name',
  'assetClass',
  'wkn',
  'isin',
  'price',
  'dayChange',
  'quantity',
  'value',
  'entryValue',
  'avgPrice',
  'gain',
  'gainPct',
  'allocation',
  'dividends',
] as const
export type PositionColumn = (typeof POSITION_COLUMNS)[number]

export const positionsCsvQuery = positionsQuery.extend({
  columns: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .filter((column): column is PositionColumn =>
              (POSITION_COLUMNS as readonly string[]).includes(column),
            )
        : [...POSITION_COLUMNS],
    ),
})

export const instrumentDetailQuery = z.object({
  accounts: accountsParam,
  period: period.default('1Y'),
})

/** Sortable columns of the bookings table (003 FR-014: every column). */
export const INVESTMENT_TX_SORTS = [
  'date',
  'amount',
  'type',
  'name',
  'account',
  'unitPrice',
  'quantity',
  'tax',
  'fee',
] as const
export type InvestmentTxSort = (typeof INVESTMENT_TX_SORTS)[number]

export const investmentTransactionsQuery = z.object({
  accounts: accountsParam,
  type: z
    .enum(['buy', 'sell', 'dividend', 'interest', 'tax', 'fee', 'split', 'deposit', 'withdrawal'])
    .optional(),
  /** Comma-separated types (filter panel, 003 FR-014); `type` stays for old links. */
  types: accountsParam,
  instrumentId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  minCents: z.coerce.number().int().safe().optional(),
  maxCents: z.coerce.number().int().safe().optional(),
  sort: z.enum(INVESTMENT_TX_SORTS).default('date'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type InvestmentTransactionsQuery = z.infer<typeof investmentTransactionsQuery>

/** Columns of the bookings table / CSV export (feature 002, US3). */
export const TRANSACTION_COLUMNS = [
  'date',
  'type',
  'name',
  'wkn',
  'isin',
  'account',
  'unitPrice',
  'quantity',
  'tax',
  'fee',
  'amount',
] as const
export type TransactionColumn = (typeof TRANSACTION_COLUMNS)[number]

export const investmentTransactionsCsvQuery = investmentTransactionsQuery
  .omit({ page: true, pageSize: true })
  .extend({
    columns: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value
              .split(',')
              .filter((column): column is TransactionColumn =>
                (TRANSACTION_COLUMNS as readonly string[]).includes(column),
              )
          : [...TRANSACTION_COLUMNS],
      ),
  })

export const investmentTransactionRow = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  bookingDate: isoDate,
  type: z.string(),
  amountCents: cents,
  quantity: decimalString.nullable(),
  unitPrice: decimalString.nullable(),
  feeCents: cents,
  taxCents: cents,
  instrumentId: z.string().nullable(),
  instrumentName: z.string().nullable(),
  isin: z.string().nullable(),
  wkn: z.string().nullable(),
})
export type InvestmentTransactionRow = z.infer<typeof investmentTransactionRow>

export const investmentTransactionsResponse = z.object({
  items: z.array(investmentTransactionRow),
  total: z.number().int(),
  /** Σ amount over all filtered rows (not only the page). */
  sumCents: cents,
})
export type InvestmentTransactionsResponse = z.infer<typeof investmentTransactionsResponse>
