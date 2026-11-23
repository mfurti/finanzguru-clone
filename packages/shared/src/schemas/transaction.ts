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

export const transactionListQuery = pagination.extend({
  accounts: accountsParam,
  categoryId: z.string().optional(),
  status: reviewStatus.optional(),
  type: transactionType.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().trim().max(100).optional(),
})
export type TransactionListQuery = z.infer<typeof transactionListQuery>
