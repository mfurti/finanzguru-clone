import { z } from 'zod'
import { accountsParam, cents, isoDate, nullableRate } from './common.js'
import { logoRef, logoSource, recipientKey } from './logo.js'

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
      /** `deficit`: spending beyond income in the period (013), shown left below Einnahmen. */
      kind: z.enum(['income', 'deficit', 'main', 'sub', 'balance']),
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
  /** Bank or broker of the account, for the booking side panel (007). */
  institutionName: z.string().nullable(),
  bookingDate: isoDate,
  amountCents: cents,
  /** Tax withheld on the booking, 0 when none (012 P1, Steuern column). */
  taxCents: cents,
  type: z.string(),
  counterparty: z.string().nullable(),
  counterpartyIban: z.string().nullable(),
  purpose: z.string().nullable(),
  /** Owner's note, max 1 000 characters (007). */
  note: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryIcon: z.string().nullable(),
  categoryColor: z.string().nullable(),
  categorySource: z.string().nullable(),
  reviewStatus: z.enum(['unreviewed', 'reviewed']),
  tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
  /** Merchant logo (008): brand or upload; null = initials. */
  logo: logoRef,
  logoSource,
  /** Key the logo choice is stored under; null for transfers and trades. */
  recipientKey: recipientKey.nullable(),
})
export type TransactionListItem = z.infer<typeof transactionListItem>

/** `GET /api/transactions` response: page plus the sum of all matching rows. */
export const transactionPage = z.object({
  items: z.array(transactionListItem),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  sumCents: cents,
})
export type TransactionPage = z.infer<typeof transactionPage>
