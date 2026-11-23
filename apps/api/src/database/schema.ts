/**
 * Drizzle schema for the shared entities (data-model.md).
 * Conventions: ids are TEXT UUIDv7, money is INTEGER cents (EUR),
 * decimals (quantity, price, rate) are TEXT parsed with decimal.js,
 * timestamps are ISO-8601 UTC TEXT, dates are YYYY-MM-DD.
 * Story-specific tables are added by their stories (dashboard_layout, import_job, …).
 */
import { sql } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  blob,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { uuidv7 } from 'uuidv7'
import {
  ACCOUNT_TYPES,
  ASSET_CLASSES,
  CATEGORY_KINDS,
  CATEGORY_SOURCES,
  PRICE_SOURCES,
  REVIEW_STATUSES,
  SOURCE_KINDS,
  SOURCE_STATUSES,
  TRANSACTION_SOURCES,
  TRANSACTION_TYPES,
  WIDGET_KEYS,
  AMOUNT_SIGNS,
  IMPORT_JOB_KINDS,
  IMPORT_JOB_STATUSES,
  RULE_MATCH_FIELDS,
  RULE_OPERATORS,
} from '@finance/shared'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

/** `column IN ('a', 'b')` for CHECK constraints built from the enum lists below. */
const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} IN (${values.map((value) => `'${value}'`).join(', ')})`)

/** Single owner row (id fixed to 'owner'). */
export const owner = sqliteTable(
  'owner',
  {
    id: text('id').primaryKey().default('owner'),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    inflationRate: text('inflation_rate').notNull().default('0.0253'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    check('owner_single_row', sql`${t.id} = 'owner'`),
    check('owner_display_name_len', sql`length(${t.displayName}) BETWEEN 1 AND 60`),
    check(
      'owner_inflation_range',
      sql`CAST(${t.inflationRate} AS REAL) >= 0 AND CAST(${t.inflationRate} AS REAL) <= 0.5`,
    ),
  ],
)

export const institution = sqliteTable(
  'institution',
  {
    id: id(),
    name: text('name').notNull().unique(),
    bic: text('bic'),
    logoKey: text('logo_key'),
  },
  (t) => [check('institution_bic_len', sql`${t.bic} IS NULL OR length(${t.bic}) IN (8, 11)`)],
)

export const dataSource = sqliteTable(
  'data_source',
  {
    id: id(),
    kind: text('kind', { enum: SOURCE_KINDS }).notNull(),
    status: text('status', { enum: SOURCE_STATUSES }).notNull(),
    displayName: text('display_name').notNull(),
    /** AES-256-GCM (iv + tag + ciphertext); never returned by the API. */
    encryptedCredentials: blob('encrypted_credentials', { mode: 'buffer' }),
    toolManifest: text('tool_manifest', { mode: 'json' }),
    lastSyncAt: text('last_sync_at'),
    lastError: text('last_error'),
  },
  () => [
    check('data_source_kind', inList('kind', SOURCE_KINDS)),
    check('data_source_status', inList('status', SOURCE_STATUSES)),
  ],
)

export const account = sqliteTable(
  'account',
  {
    id: id(),
    institutionId: text('institution_id')
      .notNull()
      .references(() => institution.id),
    name: text('name').notNull(),
    type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
    /** Validated IBAN checksum at the API; unique when set. */
    iban: text('iban').unique(),
    parentAccountId: text('parent_account_id').references((): AnySQLiteColumn => account.id),
    sourceId: text('source_id').references(() => dataSource.id),
    balanceCents: integer('balance_cents').notNull().default(0),
    isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    lastSyncedAt: text('last_synced_at'),
  },
  (t) => [
    check('account_name_len', sql`length(${t.name}) BETWEEN 1 AND 80`),
    check('account_type', inList('type', ACCOUNT_TYPES)),
  ],
)

export const instrument = sqliteTable(
  'instrument',
  {
    id: id(),
    /** Unique; ISIN checksum validated at the API. */
    isin: text('isin').notNull().unique(),
    wkn: text('wkn'),
    name: text('name').notNull(),
    assetClass: text('asset_class', { enum: ASSET_CLASSES }).notNull(),
    currency: text('currency').notNull().default('EUR'),
  },
  (t) => [
    check('instrument_isin_len', sql`length(${t.isin}) = 12`),
    check('instrument_wkn_len', sql`${t.wkn} IS NULL OR length(${t.wkn}) = 6`),
    check('instrument_asset_class', inList('asset_class', ASSET_CLASSES)),
    check('instrument_currency_len', sql`length(${t.currency}) = 3`),
  ],
)

export const price = sqliteTable(
  'price',
  {
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    /** Close in EUR, > 0. */
    close: text('close').notNull(),
    source: text('source', { enum: PRICE_SOURCES }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.instrumentId, t.date] }),
    check('price_close_positive', sql`CAST(${t.close} AS REAL) > 0`),
    check('price_source', inList('source', PRICE_SOURCES)),
  ],
)

export const category = sqliteTable(
  'category',
  {
    id: id(),
    /** Max depth 2 (enforced in the categories service). */
    parentId: text('parent_id').references((): AnySQLiteColumn => category.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    color: text('color').notNull().default('neutral'),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    /** Parent id or '' so top-level names are unique too (SQLite treats NULLs as distinct). */
    parentKey: text('parent_key').generatedAlwaysAs(sql`coalesce(parent_id, '')`, {
      mode: 'virtual',
    }),
  },
  (t) => [
    uniqueIndex('category_parent_name_unique').on(t.parentKey, t.name),
    check('category_kind', inList('kind', CATEGORY_KINDS)),
  ],
)

export const transaction = sqliteTable(
  'transactions',
  {
    id: id(),
    accountId: text('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    bookingDate: text('booking_date').notNull(),
    valueDate: text('value_date'),
    /** + inflow / − outflow from the account's view. */
    amountCents: integer('amount_cents').notNull(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    counterparty: text('counterparty'),
    counterpartyIban: text('counterparty_iban'),
    purpose: text('purpose'),
    instrumentId: text('instrument_id').references(() => instrument.id),
    quantity: text('quantity'),
    unitPrice: text('unit_price'),
    feeCents: integer('fee_cents').notNull().default(0),
    taxCents: integer('tax_cents').notNull().default(0),
    categoryId: text('category_id').references(() => category.id, { onDelete: 'set null' }),
    categorySource: text('category_source', { enum: CATEGORY_SOURCES }),
    reviewStatus: text('review_status', { enum: REVIEW_STATUSES }).notNull().default('unreviewed'),
    source: text('source', { enum: TRANSACTION_SOURCES }).notNull(),
    sourceRef: text('source_ref'),
    fingerprint: text('fingerprint').notNull().unique(),
    /** Set by the import pipeline; the import_job table arrives with US2. */
    importJobId: text('import_job_id'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    index('transactions_account_booking_idx').on(t.accountId, t.bookingDate),
    index('transactions_category_idx').on(t.categoryId),
    uniqueIndex('transactions_source_ref_unique').on(t.source, t.sourceRef),
    check('transactions_type', inList('type', TRANSACTION_TYPES)),
    check('transactions_review_status', inList('review_status', REVIEW_STATUSES)),
    check('transactions_source', inList('source', TRANSACTION_SOURCES)),
    check(
      'transactions_category_source',
      sql`${t.categorySource} IS NULL OR ${inList('category_source', CATEGORY_SOURCES)}`,
    ),
    check(
      'transactions_instrument_required',
      sql`${t.type} NOT IN ('buy', 'sell', 'dividend', 'split') OR ${t.instrumentId} IS NOT NULL`,
    ),
    check(
      'transactions_quantity_required',
      sql`${t.type} NOT IN ('buy', 'sell', 'split') OR ${t.quantity} IS NOT NULL`,
    ),
  ],
)

/** Derived, rebuildable daily values per account. */
export const netWorthSnapshot = sqliteTable(
  'net_worth_snapshot',
  {
    accountId: text('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    valueCents: integer('value_cents').notNull(),
    investedCents: integer('invested_cents').notNull(),
    externalFlowCents: integer('external_flow_cents').notNull().default(0),
    priceStale: integer('price_stale', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.date] })],
)

/** Derived, rebuildable FIFO lots per depot and instrument. */
export const positionLot = sqliteTable(
  'position_lot',
  {
    id: id(),
    accountId: text('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id),
    openDate: text('open_date').notNull(),
    quantityOpen: text('quantity_open').notNull(),
    costPerUnit: text('cost_per_unit').notNull(),
    closed: integer('closed', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    index('position_lot_account_instrument_idx').on(t.accountId, t.instrumentId),
    check('position_lot_quantity_non_negative', sql`CAST(${t.quantityOpen} AS REAL) >= 0`),
  ],
)

/** Order and visibility of the overview widgets (US1, FR-013). */
export const dashboardLayout = sqliteTable(
  'dashboard_layout',
  {
    widgetKey: text('widget_key', { enum: WIDGET_KEYS }).primaryKey(),
    position: integer('position').notNull(),
    visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
  },
  () => [check('dashboard_layout_widget_key', inList('widget_key', WIDGET_KEYS))],
)

/** One CSV upload or sync run (US2). Max 500 row errors are kept. */
export const importJob = sqliteTable(
  'import_job',
  {
    id: id(),
    sourceId: text('source_id')
      .notNull()
      .references(() => dataSource.id),
    kind: text('kind', { enum: IMPORT_JOB_KINDS }).notNull(),
    fileName: text('file_name'),
    fileSha256: text('file_sha256'),
    format: text('format'),
    accountId: text('account_id').references(() => account.id, { onDelete: 'set null' }),
    status: text('status', { enum: IMPORT_JOB_STATUSES }).notNull().default('pending'),
    imported: integer('imported').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    /** `[{ line, reason }]`, max 500 kept. */
    errors: text('errors', { mode: 'json' })
      .$type<{ line?: number; reason: string }[]>()
      .notNull()
      .default([]),
    startedAt: text('started_at').notNull().default(nowIso),
    finishedAt: text('finished_at'),
  },
  () => [
    check('import_job_kind', inList('kind', IMPORT_JOB_KINDS)),
    check('import_job_status', inList('status', IMPORT_JOB_STATUSES)),
  ],
)

/** Saved column mapping for a CSV layout, recognized by its header signature. */
export const csvMapping = sqliteTable('csv_mapping', {
  id: id(),
  name: text('name').notNull(),
  /** Hash of the normalized header row. */
  headerSignature: text('header_signature').notNull().unique(),
  delimiter: text('delimiter').notNull(),
  encoding: text('encoding').notNull(),
  dateFormat: text('date_format').notNull(),
  decimalSeparator: text('decimal_separator').notNull(),
  skipRows: integer('skip_rows').notNull().default(0),
  columns: text('columns', { mode: 'json' }).$type<Record<string, number>>().notNull(),
  defaultAccountId: text('default_account_id').references(() => account.id, {
    onDelete: 'set null',
  }),
})

/** Ordered auto-categorization rule; first match wins (research R11). */
export const categorizationRule = sqliteTable(
  'categorization_rule',
  {
    id: id(),
    /** Ascending, unique. */
    priority: integer('priority').notNull().unique(),
    matchField: text('match_field', { enum: RULE_MATCH_FIELDS }).notNull(),
    operator: text('operator', { enum: RULE_OPERATORS }).notNull(),
    /** For `regex` the pattern must compile (validated in the API). */
    pattern: text('pattern').notNull(),
    amountSign: text('amount_sign', { enum: AMOUNT_SIGNS }),
    categoryId: text('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    check('categorization_rule_match_field', inList('match_field', RULE_MATCH_FIELDS)),
    check('categorization_rule_operator', inList('operator', RULE_OPERATORS)),
    check(
      'categorization_rule_amount_sign',
      sql`${t.amountSign} IS NULL OR ${inList('amount_sign', AMOUNT_SIGNS)}`,
    ),
    check('categorization_rule_pattern_len', sql`length(${t.pattern}) BETWEEN 1 AND 200`),
  ],
)

/** Monthly limit per expense category (US5, FR-035). */
export const budget = sqliteTable(
  'budget',
  {
    id: id(),
    /** Unique; expense kind only (checked in the API). */
    categoryId: text('category_id')
      .notNull()
      .unique()
      .references(() => category.id, { onDelete: 'cascade' }),
    monthlyLimitCents: integer('monthly_limit_cents').notNull(),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [check('budget_limit_positive', sql`${t.monthlyLimitCents} > 0`)],
)

export const schema = {
  owner,
  institution,
  dataSource,
  account,
  instrument,
  price,
  category,
  transaction,
  netWorthSnapshot,
  positionLot,
  dashboardLayout,
  importJob,
  csvMapping,
  categorizationRule,
  budget,
}
