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
  INSURANCE_TYPES,
  PREMIUM_INTERVALS,
  ASSESSMENTS,
  FUND_TYPES,
  WEIGHT_DIMENSIONS,
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
    /** Partial exemption class for funds (feature 002); null for non-funds. */
    fundType: text('fund_type', { enum: FUND_TYPES }),
    /** Selectable in "Vergleichen mit" (feature 002). */
    isBenchmark: integer('is_benchmark', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    check('instrument_fund_type', sql`${t.fundType} IS NULL OR ${inList('fund_type', FUND_TYPES)}`),
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
    /** Key from CATEGORY_ICONS (validated in the API, no CHECK so the list can grow). */
    icon: text('icon').notNull().default('tag'),
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
    /** Owner's note (007), max 1 000 characters. */
    note: text('note'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    index('transactions_account_booking_idx').on(t.accountId, t.bookingDate),
    index('transactions_booking_id_idx').on(t.bookingDate, t.id),
    index('transactions_category_idx').on(t.categoryId),
    uniqueIndex('transactions_source_ref_unique').on(t.source, t.sourceRef),
    check('transactions_type', inList('type', TRANSACTION_TYPES)),
    check('transactions_review_status', inList('review_status', REVIEW_STATUSES)),
    check('transactions_note_len', sql`${t.note} IS NULL OR length(${t.note}) <= 1000`),
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

/** Manual insurance contract (US6). */
export const insuranceContract = sqliteTable(
  'insurance_contract',
  {
    id: id(),
    type: text('type', { enum: INSURANCE_TYPES }).notNull(),
    provider: text('provider').notNull(),
    contractNumber: text('contract_number'),
    /** Premium per interval, > 0. */
    premiumCents: integer('premium_cents').notNull(),
    interval: text('interval', { enum: PREMIUM_INTERVALS }).notNull(),
    startDate: text('start_date').notNull(),
    /** Optional, >= start_date. */
    endDate: text('end_date'),
    /** At most 2000 characters. */
    notes: text('notes'),
    linkedCategoryId: text('linked_category_id').references(() => category.id, {
      onDelete: 'set null',
    }),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    check('insurance_type', inList('type', INSURANCE_TYPES)),
    check('insurance_interval', inList('interval', PREMIUM_INTERVALS)),
    check('insurance_premium_positive', sql`${t.premiumCents} > 0`),
    check('insurance_end_after_start', sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
    check('insurance_notes_len', sql`${t.notes} IS NULL OR length(${t.notes}) <= 2000`),
    check('insurance_provider_len', sql`length(${t.provider}) BETWEEN 1 AND 120`),
  ],
)

// --- Feature 002: investment analysis, dividends, taxes, watchlists ---

/** Weighted region/sector/currency share of an instrument; Σ per dimension <= 1. */
export const instrumentWeight = sqliteTable(
  'instrument_weight',
  {
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id, { onDelete: 'cascade' }),
    dimension: text('dimension', { enum: WEIGHT_DIMENSIONS }).notNull(),
    key: text('key').notNull(),
    /** Decimal string, 0 < w <= 1. */
    weight: text('weight').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.instrumentId, t.dimension, t.key] }),
    check('instrument_weight_dimension', inList('dimension', WEIGHT_DIMENSIONS)),
    check(
      'instrument_weight_range',
      sql`CAST(${t.weight} AS REAL) > 0 AND CAST(${t.weight} AS REAL) <= 1`,
    ),
  ],
)

/** Owner-defined grouping (e.g. "Kern/Satellit"). */
export const customGrouping = sqliteTable(
  'custom_grouping',
  {
    id: id(),
    name: text('name').notNull().unique(),
  },
  (t) => [check('custom_grouping_name_len', sql`length(${t.name}) BETWEEN 1 AND 60`)],
)

export const customGroup = sqliteTable(
  'custom_group',
  {
    id: id(),
    groupingId: text('grouping_id')
      .notNull()
      .references(() => customGrouping.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    uniqueIndex('custom_group_name_unique').on(t.groupingId, t.name),
    check('custom_group_name_len', sql`length(${t.name}) BETWEEN 1 AND 60`),
  ],
)

/** One group per grouping and instrument. */
export const customGroupMember = sqliteTable(
  'custom_group_member',
  {
    groupingId: text('grouping_id')
      .notNull()
      .references(() => customGrouping.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => customGroup.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupingId, t.instrumentId] })],
)

/** Yearly inflation; falls back to owner.inflation_rate. */
export const inflationRate = sqliteTable(
  'inflation_rate',
  {
    year: integer('year').primaryKey(),
    rate: text('rate').notNull(),
  },
  (t) => [
    check('inflation_rate_year', sql`${t.year} BETWEEN 1990 AND 2100`),
    check(
      'inflation_rate_range',
      sql`CAST(${t.rate} AS REAL) >= -0.1 AND CAST(${t.rate} AS REAL) <= 0.5`,
    ),
  ],
)

/** Owner-entered upcoming dividend payment. */
export const expectedDividend = sqliteTable(
  'expected_dividend',
  {
    id: id(),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id, { onDelete: 'cascade' }),
    payDate: text('pay_date').notNull(),
    exDate: text('ex_date'),
    /** EUR per share, decimal string > 0. */
    amountPerShare: text('amount_per_share').notNull(),
    note: text('note'),
  },
  (t) => [
    index('expected_dividend_pay_date_idx').on(t.payDate),
    check(
      'expected_dividend_ex_before_pay',
      sql`${t.exDate} IS NULL OR ${t.exDate} <= ${t.payDate}`,
    ),
    check('expected_dividend_amount_positive', sql`CAST(${t.amountPerShare} AS REAL) > 0`),
    check('expected_dividend_note_len', sql`${t.note} IS NULL OR length(${t.note}) <= 200`),
  ],
)

/** Tax settings per calendar year. */
export const taxYear = sqliteTable(
  'tax_year',
  {
    year: integer('year').primaryKey(),
    assessment: text('assessment', { enum: ASSESSMENTS }).notNull().default('single'),
    /** Basiszins as decimal string, 0 … 0.2. */
    baseRate: text('base_rate'),
  },
  (t) => [
    check('tax_year_assessment', inList('assessment', ASSESSMENTS)),
    check(
      'tax_year_base_rate',
      sql`${t.baseRate} IS NULL OR (CAST(${t.baseRate} AS REAL) >= 0 AND CAST(${t.baseRate} AS REAL) <= 0.2)`,
    ),
  ],
)

/** Freistellungsauftrag per broker and year. */
export const exemptionOrder = sqliteTable(
  'exemption_order',
  {
    id: id(),
    institutionId: text('institution_id')
      .notNull()
      .references(() => institution.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    amountCents: integer('amount_cents').notNull(),
  },
  (t) => [
    uniqueIndex('exemption_order_institution_year').on(t.institutionId, t.year),
    check('exemption_order_amount', sql`${t.amountCents} >= 0`),
  ],
)

export const watchlist = sqliteTable(
  'watchlist',
  {
    id: id(),
    name: text('name').notNull().unique(),
    position: integer('position').notNull().default(0),
  },
  (t) => [check('watchlist_name_len', sql`length(${t.name}) BETWEEN 1 AND 60`)],
)

export const watchlistEntry = sqliteTable(
  'watchlist_entry',
  {
    watchlistId: text('watchlist_id')
      .notNull()
      .references(() => watchlist.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    addedAt: text('added_at').notNull().default(nowIso),
  },
  (t) => [primaryKey({ columns: [t.watchlistId, t.instrumentId] })],
)

/** Allowlisted key/value settings (chart benchmarks). */
export const userSetting = sqliteTable('user_setting', {
  key: text('key').primaryKey(),
  value: text('value'),
})

/** Free-text label on bookings (003 US1); name unique case-insensitively. */
export const tag = sqliteTable(
  'tag',
  {
    id: id(),
    name: text('name').notNull(),
    color: text('color').notNull().default('neutral'),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [
    uniqueIndex('tag_name_lower_unique').on(sql`lower(${t.name})`),
    check('tag_name_len', sql`length(${t.name}) BETWEEN 1 AND 40`),
  ],
)

export const transactionTag = sqliteTable(
  'transaction_tag',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transaction.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.transactionId, t.tagId] }),
    index('transaction_tag_tag_idx').on(t.tagId),
  ],
)

/** Remembers purged imported bookings so a re-import skips them (FR-007). */
export const deletedImportMarker = sqliteTable(
  'deleted_import_marker',
  {
    id: id(),
    source: text('source').notNull(),
    fingerprint: text('fingerprint').notNull(),
    sourceRef: text('source_ref'),
    deletedAt: text('deleted_at').notNull().default(nowIso),
  },
  (t) => [uniqueIndex('deleted_import_marker_unique').on(t.source, t.fingerprint)],
)

/** One sync of a pull source (004 US1); token values never go into `error`. */
export const syncRun = sqliteTable(
  'sync_run',
  {
    id: id(),
    sourceId: text('source_id')
      .notNull()
      .references(() => dataSource.id, { onDelete: 'cascade' }),
    startedAt: text('started_at').notNull().default(nowIso),
    finishedAt: text('finished_at'),
    status: text('status', { enum: ['running', 'succeeded', 'partial', 'failed'] }).notNull(),
    imported: integer('imported').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    error: text('error'),
  },
  (t) => [
    index('sync_run_source_started_idx').on(t.sourceId, t.startedAt),
    check('sync_run_status', inList('status', ['running', 'succeeded', 'partial', 'failed'])),
    check('sync_run_counts', sql`${t.imported} >= 0 AND ${t.skipped} >= 0`),
    check('sync_run_error_len', sql`${t.error} IS NULL OR length(${t.error}) <= 500`),
  ],
)

/** Derived daily value per depot and instrument (004 US2); rebuilt with net_worth_snapshot. */
export const instrumentValueSnapshot = sqliteTable(
  'instrument_value_snapshot',
  {
    accountId: text('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    instrumentId: text('instrument_id')
      .notNull()
      .references(() => instrument.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    valueCents: integer('value_cents').notNull(),
    investedCents: integer('invested_cents').notNull(),
    /** Net buys (+) minus sells (−) on that day, in cents (005 R5). */
    flowCents: integer('flow_cents').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.accountId, t.instrumentId, t.date] }),
    index('instrument_value_snapshot_instrument_date_idx').on(t.instrumentId, t.date),
  ],
)

/**
 * Bank consent at Enable Banking (005 US1). The session id lives encrypted in
 * `data_source.encrypted_credentials`, never here.
 */
export const bankConsent = sqliteTable(
  'bank_consent',
  {
    sourceId: text('source_id')
      .primaryKey()
      .references(() => dataSource.id, { onDelete: 'cascade' }),
    aspspName: text('aspsp_name').notNull(),
    aspspCountry: text('aspsp_country').notNull(),
    /** ISO date-time from the session. */
    validUntil: text('valid_until').notNull(),
    createdAt: text('created_at').notNull().default(nowIso),
  },
  (t) => [check('bank_consent_country', sql`length(${t.aspspCountry}) = 2`)],
)

/** Latest broker quote per instrument (005 US4); prices are EUR decimal strings. */
export const quote = sqliteTable(
  'quote',
  {
    instrumentId: text('instrument_id')
      .primaryKey()
      .references(() => instrument.id, { onDelete: 'cascade' }),
    price: text('price').notNull(),
    changeAbs: text('change_abs'),
    changePct: text('change_pct'),
    quotedAt: text('quoted_at').notNull(),
    fetchedAt: text('fetched_at').notNull().default(nowIso),
  },
  (t) => [check('quote_price_positive', sql`CAST(${t.price} AS REAL) > 0`)],
)

/**
 * Counts manual categorizations per recipient and category (006 US2, research R4). From the
 * second one the app suggests a rule; a declined suggestion is never shown again.
 */
export const ruleSuggestion = sqliteTable(
  'rule_suggestion',
  {
    id: id(),
    /** Normalized counterparty (see domain/categorize.ts counterpartyKey). */
    counterpartyKey: text('counterparty_key').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    count: integer('count').notNull().default(0),
    status: text('status', { enum: ['open', 'accepted', 'declined'] })
      .notNull()
      .default('open'),
    updatedAt: text('updated_at').notNull().default(nowIso),
  },
  (t) => [
    uniqueIndex('rule_suggestion_pair_idx').on(t.counterpartyKey, t.categoryId),
    check('rule_suggestion_key_len', sql`length(${t.counterpartyKey}) BETWEEN 1 AND 200`),
    check('rule_suggestion_count', sql`${t.count} >= 0`),
    check('rule_suggestion_status', inList('status', ['open', 'accepted', 'declined'])),
  ],
)

/**
 * Logo choice per recipient (008): a built-in brand, "Kein Logo", or an own upload. Keyed by
 * the normalized recipient key (domain/logo.ts recipientKey), so it covers future bookings too.
 */
export const recipientLogo = sqliteTable(
  'recipient_logo',
  {
    recipientKey: text('recipient_key').primaryKey(),
    mode: text('mode', { enum: ['brand', 'none', 'upload'] }).notNull(),
    brandSlug: text('brand_slug'),
    fileName: text('file_name'),
    updatedAt: text('updated_at').notNull().default(nowIso),
  },
  (t) => [
    check('recipient_logo_key_len', sql`length(${t.recipientKey}) BETWEEN 1 AND 200`),
    check('recipient_logo_mode', inList('mode', ['brand', 'none', 'upload'])),
    check('recipient_logo_brand', sql`(${t.mode} = 'brand') = (${t.brandSlug} IS NOT NULL)`),
    check('recipient_logo_file', sql`(${t.mode} = 'upload') = (${t.fileName} IS NOT NULL)`),
  ],
)

export const schema = {
  recipientLogo,
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
  insuranceContract,
  instrumentWeight,
  customGrouping,
  customGroup,
  customGroupMember,
  inflationRate,
  expectedDividend,
  taxYear,
  exemptionOrder,
  watchlist,
  watchlistEntry,
  userSetting,
  tag,
  transactionTag,
  deletedImportMarker,
  syncRun,
  instrumentValueSnapshot,
  bankConsent,
  quote,
  ruleSuggestion,
}
