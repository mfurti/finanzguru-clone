import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER, runMigrations } from '../../src/database/migrate'
import {
  account,
  bankConsent,
  dataSource,
  institution,
  instrument,
  quote,
  syncRun,
  tag,
  transaction,
  transactionTag,
} from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

/** Migrations up to (excluding) `tag`, in a temporary copy of the folder. */
function foldersBefore(tagPrefix: string): string {
  const partial = mkdtempSync(join(tmpdir(), 'mig-'))
  cpSync(MIGRATIONS_FOLDER, partial, { recursive: true })
  const journalPath = join(partial, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
  journal.entries = journal.entries.filter((entry) => entry.tag < tagPrefix)
  writeFileSync(journalPath, JSON.stringify(journal))
  return partial
}

describe('feature 005 schema (migration 0008)', () => {
  it('accepts the new source kind, status and transaction source', () => {
    const db = createTestDb()
    db.insert(dataSource)
      .values({
        id: 'enable_banking',
        kind: 'enable_banking',
        status: 'consent_expired',
        displayName: 'Bank',
      })
      .run()
    db.insert(bankConsent)
      .values({
        sourceId: 'enable_banking',
        aspspName: 'Sparkasse',
        aspspCountry: 'DE',
        validUntil: '2027-02-22T00:00:00Z',
      })
      .run()
    expect(() =>
      db
        .insert(bankConsent)
        .values({
          sourceId: 'csv',
          aspspName: 'X',
          aspspCountry: 'DEU',
          validUntil: '2027-01-01T00:00:00Z',
        })
        .run(),
    ).toThrow(/bank_consent_country/)
    // Deleting the source removes its consent.
    db.delete(dataSource).run()
    expect(db.select().from(bankConsent).all()).toEqual([])
  })

  it('stores quotes with a positive price and drops them with the instrument', () => {
    const db = createTestDb()
    db.insert(instrument)
      .values({ id: 'i1', isin: 'DE0000000001', name: 'Test', assetClass: 'stock' })
      .run()
    db.insert(quote)
      .values({ instrumentId: 'i1', price: '12.34', quotedAt: '2026-11-24T10:00:00Z' })
      .run()
    expect(() =>
      db.insert(quote).values({ instrumentId: 'i1', price: '0', quotedAt: 'x' }).run(),
    ).toThrow()
    db.delete(instrument).run()
    expect(db.select().from(quote).all()).toEqual([])
  })

  it('upgrades a 0007 database without losing rows in rebuilt tables or their children', () => {
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle({ client: sqlite })
    migrate(db, { migrationsFolder: foldersBefore('0008') })
    db.insert(dataSource)
      .values({ id: 'scalable_mcp', kind: 'scalable_mcp', status: 'active', displayName: 'S' })
      .run()
    db.insert(syncRun).values({ sourceId: 'scalable_mcp', status: 'succeeded' }).run()
    db.insert(institution).values({ id: 'in1', name: 'Bank' }).run()
    db.insert(account)
      .values({
        id: 'a1',
        institutionId: 'in1',
        name: 'Giro',
        type: 'checking',
        sourceId: 'scalable_mcp',
      })
      .run()
    db.insert(transaction)
      .values({
        id: 't1',
        accountId: 'a1',
        bookingDate: '2026-11-01',
        amountCents: -500,
        type: 'expense',
        source: 'csv',
        fingerprint: 'f1',
      })
      .run()
    db.insert(tag).values({ id: 'g1', name: 'Urlaub' }).run()
    db.insert(transactionTag).values({ transactionId: 't1', tagId: 'g1' }).run()

    runMigrations(db)

    const count = (table: string) =>
      (sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n
    expect(count('data_source')).toBeGreaterThanOrEqual(1)
    expect(count('sync_run')).toBe(1)
    expect(count('account')).toBe(1)
    expect(count('transactions')).toBe(1)
    expect(count('transaction_tag')).toBe(1)
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    // The new values are accepted after the upgrade.
    db.insert(transaction)
      .values({
        id: 't2',
        accountId: 'a1',
        bookingDate: '2026-11-02',
        amountCents: 100,
        type: 'income',
        source: 'enable_banking',
        sourceRef: 'ref-1',
        fingerprint: 'f2',
      })
      .run()
    expect(
      sqlite.prepare('SELECT flow_cents FROM instrument_value_snapshot LIMIT 1').all(),
    ).toEqual([])
  })
})
