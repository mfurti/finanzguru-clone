import { z } from 'zod'
import { accountsParam, cents, isoDate, nullableRate } from './common.js'

export const cashflowQuery = z.object({
  accounts: accountsParam,
  granularity: z.enum(['month', 'quarter', 'year']).default('month'),
  /** Any date inside the period; defaults to today. */
  anchor: isoDate.optional(),
})
export type CashflowQuery = z.infer<typeof cashflowQuery>

export const cashflowCategoriesQuery = cashflowQuery.extend({
  kind: z.enum(['expense', 'income']).default('expense'),
})

export const cashflowSummary = z.object({
  period: z.object({ from: isoDate, to: isoDate, label: z.string() }),
  incomeCents: cents,
  expenseCents: cents,
  balanceCents: cents,
  savedCents: cents,
  savingsRate: nullableRate,
  bars: z.array(
    z.object({
      label: z.string(),
      from: isoDate,
      to: isoDate,
      incomeCents: cents,
      expenseCents: cents,
      isCurrent: z.boolean(),
    }),
  ),
})
export type CashflowSummary = z.infer<typeof cashflowSummary>

export const sankeyResponse = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(['income', 'main', 'sub', 'balance']),
    }),
  ),
  links: z.array(z.object({ source: z.string(), target: z.string(), valueCents: cents })),
})
export type SankeyResponse = z.infer<typeof sankeyResponse>

const categoryTotalBase = z.object({
  categoryId: z.string(),
  name: z.string(),
  color: z.string(),
  count: z.number().int(),
  totalCents: cents,
  pct: nullableRate,
})

export const cashflowCategories = z.object({
  totalCents: cents,
  count: z.number().int(),
  items: z.array(categoryTotalBase.extend({ children: z.array(categoryTotalBase) })),
})
export type CashflowCategories = z.infer<typeof cashflowCategories>

/** Row of `GET /api/transactions`. */
export const transactionListItem = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string(),
  bookingDate: isoDate,
  amountCents: cents,
  type: z.string(),
  counterparty: z.string().nullable(),
  purpose: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  categorySource: z.string().nullable(),
  reviewStatus: z.enum(['unreviewed', 'reviewed']),
})
export type TransactionListItem = z.infer<typeof transactionListItem>
