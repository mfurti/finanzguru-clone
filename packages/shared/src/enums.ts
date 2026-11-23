/** Enum values shared by the database schema, the API DTOs and the web app (data-model.md). */

export const ACCOUNT_TYPES = [
  'depot',
  'checking',
  'savings',
  'reference',
  'credit_card',
  'cash',
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ASSET_CLASSES = [
  'stock',
  'etf',
  'fund',
  'bond',
  'crypto',
  'commodity',
  'other',
] as const
export type AssetClass = (typeof ASSET_CLASSES)[number]

export const PRICE_SOURCES = ['scalable', 'csv', 'manual'] as const
export type PriceSource = (typeof PRICE_SOURCES)[number]

export const TRANSACTION_TYPES = [
  'income',
  'expense',
  'transfer',
  'buy',
  'sell',
  'dividend',
  'interest',
  'tax',
  'fee',
  'split',
  'deposit',
  'withdrawal',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const CATEGORY_SOURCES = ['manual', 'rule', 'import'] as const
export type CategorySource = (typeof CATEGORY_SOURCES)[number]

export const REVIEW_STATUSES = ['unreviewed', 'reviewed'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const TRANSACTION_SOURCES = ['csv', 'scalable_mcp', 'manual'] as const
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

export const CATEGORY_KINDS = ['income', 'expense', 'savings', 'transfer'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export const SOURCE_KINDS = ['csv', 'scalable_mcp', 'sparkasse_fints'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export const SOURCE_STATUSES = ['active', 'needs_reauth', 'error', 'planned', 'disabled'] as const
export type SourceStatus = (typeof SOURCE_STATUSES)[number]

/** Overview widgets in their default order (dashboard_layout.widget_key). */
export const WIDGET_KEYS = [
  'networth',
  'allocation',
  'kpis',
  'holdings',
  'accounts',
  'review',
  'cashflow',
  'budgets',
] as const
export type WidgetKey = (typeof WIDGET_KEYS)[number]

/** Chart/KPI periods (contracts/http-api.md, common query param `period`). */
export const PERIODS = ['1W', '1M', 'YTD', '1Y', '3Y', '5Y', 'ALL'] as const
export type Period = (typeof PERIODS)[number]
