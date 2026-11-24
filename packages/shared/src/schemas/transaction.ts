import { z } from 'zod'
import {
  CATEGORY_SOURCES,
  REVIEW_STATUSES,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
} from '../enums.js'
import { accountsParam, cents, decimalString, isoDate, pagination } from './common.js'

export const transactionType = z.enum(TRANSACTION_TYPES)
export const reviewStatus = z.enum(REVIEW_STATUSES)

export const transactionDto = z.object({
  id: z.string(),
  accountId: z.string(),
  bookingDate: isoDate,
  valueDate: isoDate.nullable(),
  amountCents: cents,
  type: transactionType,
  counterparty: z.string().nullable(),
  counterpartyIban: z.string().nullable(),
  purpose: z.string().nullable(),
  instrumentId: z.string().nullable(),
  quantity: decimalString.nullable(),
  unitPrice: decimalString.nullable(),
  feeCents: cents,
  taxCents: cents,
  categoryId: z.string().nullable(),
  categorySource: z.enum(CATEGORY_SOURCES).nullable(),
  reviewStatus,
  source: z.enum(TRANSACTION_SOURCES),
})
export type TransactionDto = z.infer<typeof transactionDto>

const needsInstrument = new Set(['buy', 'sell', 'dividend', 'split'])
const needsQuantity = new Set(['buy', 'sell', 'split'])

/** Manual transaction (FR-056). */
export const createTransactionInput = z
  .object({
    accountId: z.string().min(1),
    bookingDate: isoDate,
    valueDate: isoDate.optional(),
    amountCents: cents,
    type: transactionType,
    counterparty: z.string().trim().max(200).optional(),
    counterpartyIban: z.string().trim().optional(),
    purpose: z.string().trim().max(500).optional(),
    isin: z.string().trim().length(12).optional(),
    quantity: decimalString.optional(),
    unitPrice: decimalString.optional(),
    feeCents: cents.min(0).default(0),
    taxCents: cents.min(0).default(0),
    categoryId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (needsInstrument.has(value.type) && !value.isin) {
      ctx.addIssue({ code: 'custom', path: ['isin'], message: 'Required for this type' })
    }
    if (needsQuantity.has(value.type) && !value.quantity) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Required for this type' })
    }
  })
export type CreateTransactionInput = z.infer<typeof createTransactionInput>

export const updateTransactionInput = z.object({
  categoryId: z.string().nullable().optional(),
  reviewStatus: reviewStatus.optional(),
  tagIds: z.array(z.string().min(1)).max(20).optional(),
  type: transactionType.optional(),
  createRule: z
    .object({
      matchField: z.enum(['counterparty', 'purpose', 'counterparty_iban']),
      operator: z.enum(['contains', 'equals', 'starts_with', 'regex']),
      pattern: z.string().min(1).max(200),
    })
    .optional(),
})
export type UpdateTransactionInput = z.infer<typeof updateTransactionInput>

/** Sortable columns of the transactions table (R1). */
export const TRANSACTION_SORTS = ['date', 'amount', 'counterparty', 'category', 'account'] as const
export type TransactionSort = (typeof TRANSACTION_SORTS)[number]
/** Page sizes offered in the table; the API accepts any size 1–200 for scripts and tests. */
export const TRANSACTION_PAGE_SIZES = [25, 50, 100] as const

const centsParam = z.coerce.number().int().safe().optional()

/** Filter part of the transactions query, shared by list, export and bulk (R1, R2). */
export const transactionFilter = z.object({
  accounts: accountsParam,
  categoryId: z.string().optional(),
  categoryIds: accountsParam,
  tagIds: accountsParam,
  status: reviewStatus.optional(),
  review: z.enum(['all', 'unreviewed', 'reviewed']).optional(),
  type: transactionType.optional(),
  types: accountsParam,
  from: isoDate.optional(),
  to: isoDate.optional(),
  minCents: centsParam,
  maxCents: centsParam,
  q: z.string().trim().max(100).optional(),
})
export type TransactionFilter = z.infer<typeof transactionFilter>

const sorting = z.object({
  sort: z.enum(TRANSACTION_SORTS).default('date'),
  dir: z.enum(['asc', 'desc']).default('desc'),
})

const rangeOrder = <T extends { from?: string; to?: string }>(q: T) =>
  !q.from || !q.to || q.from <= q.to
const rangeIssue = { message: '`from` must not be after `to`', path: ['from'] }

export const transactionListQuery = transactionFilter
  .extend(pagination.shape)
  .extend(sorting.shape)
  .refine(rangeOrder, rangeIssue)
export type TransactionListQuery = z.infer<typeof transactionListQuery>

/** CSV export: same filter and sort, optional column choice and order. */
export const TRANSACTION_EXPORT_COLUMNS = [
  'date',
  'counterparty',
  'purpose',
  'category',
  'tags',
  'account',
  'amount',
] as const
export type TransactionExportColumn = (typeof TRANSACTION_EXPORT_COLUMNS)[number]
export const transactionExportQuery = transactionFilter
  .extend(sorting.shape)
  .extend({
    columns: accountsParam.pipe(z.array(z.enum(TRANSACTION_EXPORT_COLUMNS)).optional()),
  })
  .refine(rangeOrder, rangeIssue)
export type TransactionExportQuery = z.infer<typeof transactionExportQuery>

/** Bulk action on selected ids or on everything matching a filter (R2). */
export const BULK_ACTIONS = [
  'setCategory',
  'addTags',
  'removeTags',
  'markReviewed',
  'delete',
] as const
export type BulkAction = (typeof BULK_ACTIONS)[number]
export const transactionBulkInput = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(1000).optional(),
    /** Same keys as the list query (`accounts`, `review`, `q`, …) as strings. */
    filter: z.record(z.string(), z.string()).optional(),
    action: z.enum(BULK_ACTIONS),
    value: z
      .union([z.string(), z.array(z.string())])
      .nullable()
      .optional(),
  })
  .refine((input) => (input.ids ? !input.filter : !!input.filter), {
    message: 'Either `ids` or `filter`, not both',
    path: ['ids'],
  })
export type TransactionBulkInput = z.infer<typeof transactionBulkInput>
export const transactionBulkResult = z.object({
  affected: z.number().int().min(0),
  undoToken: z.string().optional(),
})
export type TransactionBulkResult = z.infer<typeof transactionBulkResult>
export const restoreInput = z.object({ undoToken: z.string().min(1) })
export type RestoreInput = z.infer<typeof restoreInput>
