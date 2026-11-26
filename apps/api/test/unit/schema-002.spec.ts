import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER } from '../../src/database/migrate'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  exemptionOrder,
  expectedDividend,
  inflationRate,
  institution,
  instrument,
  instrumentWeight,
  taxYear,
  watchlist,
} from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('feature 002 schema (migration 0005)', () => {
  let db: AppDatabase
  let instrumentId: string

  beforeEach(() => {
    db = createTestDb()
    instrumentId = db
      .insert(instrument)
      .values({ isin: 'IE00B4L5Y983', name: 'World ETF', assetClass: 'etf' })
      .returning()
      .get().id
  })

  it('defaults is_benchmark to false and allows only known fund types', () => {
    const row = db.select().from(instrument).get()!
    expect(row.isBenchmark).toBe(false)
    expect(() =>
      db
        .insert(instrument)
        .values({ isin: 'IE00BKM4GZ66', name: 'X', assetClass: 'etf', fundType: 'bad' as never })
        .run(),
    ).toThrow(/instrument_fund_type/)
  })

  it('keeps weights between 0 and 1', () => {
    const base = { instrumentId, dimension: 'region' as const, key: 'europe' }
    expect(() =>
      db
        .insert(instrumentWeight)
        .values({ ...base, weight: '0' })
        .run(),
    ).toThrow(/instrument_weight_range/)
    expect(() =>
      db
        .insert(instrumentWeight)
        .values({ ...base, weight: '1.2' })
        .run(),
    ).toThrow(/instrument_weight_range/)
    db.insert(instrumentWeight)
      .values({ ...base, weight: '0.6' })
      .run()
  })

  it('validates inflation, expected dividends, tax years and exemption orders', () => {
    expect(() => db.insert(inflationRate).values({ year: 1980, rate: '0.02' }).run()).toThrow(
      /inflation_rate_year/,
    )
    expect(() =>
      db
        .insert(expectedDividend)
        .values({ instrumentId, payDate: '2026-01-10', exDate: '2026-02-01', amountPerShare: '1' })
        .run(),
    ).toThrow(/expected_dividend_ex_before_pay/)
    expect(() => db.insert(taxYear).values({ year: 2026, baseRate: '0.3' }).run()).toThrow(
      /tax_year_base_rate/,
    )
    const institutionId = db.insert(institution).values({ name: 'Broker' }).returning().get().id
    db.insert(exemptionOrder).values({ institutionId, year: 2026, amountCents: 80_000 }).run()
    expect(() =>
      db.insert(exemptionOrder).values({ institutionId, year: 2026, amountCents: 1 }).run(),
    ).toThrow(/UNIQUE/)
    expect(() => db.insert(watchlist).values({ name: '' }).run()).toThrow(/watchlist_name_len/)
  })

  it('upgrades a 0004 database without losing prices and backfills fund types', () => {
    // Migrations folder with 0000–0004 only, then the full folder.
    const partial = mkdtempSync(join(tmpdir(), 'mig-'))
    cpSync(MIGRATIONS_FOLDER, partial, { recursive: true })
    const journalPath = join(partial, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
    journal.entries = journal.entries.filter((entry) => entry.tag < '0005')
    writeFileSync(journalPath, JSON.stringify(journal))
    expect(readdirSync(partial)).toContain('0005_investment_analysis.sql')

    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const old = drizzle({ client: sqlite })
    migrate(old, { migrationsFolder: partial })
    sqlite
      .prepare(
        "INSERT INTO instrument (id, isin, name, asset_class, currency) VALUES ('i1', 'IE00B4L5Y983', 'ETF', 'etf', 'EUR'), ('i2', 'US0378331005', 'Apple', 'stock', 'EUR')",
      )
      .run()
    sqlite
      .prepare(
        "INSERT INTO price (instrument_id, date, close, source) VALUES ('i1', '2026-01-02', '100', 'csv')",
      )
      .run()

    migrate(old, { migrationsFolder: MIGRATIONS_FOLDER })
    expect(sqlite.prepare('SELECT count(*) AS n FROM price').get()).toEqual({ n: 1 })
    expect(
      sqlite.prepare('SELECT id, fund_type, is_benchmark FROM instrument ORDER BY id').all(),
    ).toEqual([
      { id: 'i1', fund_type: 'equity', is_benchmark: 0 },
      { id: 'i2', fund_type: null, is_benchmark: 0 },
    ])
  })
})
