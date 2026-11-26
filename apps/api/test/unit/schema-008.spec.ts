import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER, runMigrations } from '../../src/database/migrate'
import { recipientLogo, transaction } from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('feature 008 schema (migration 0011)', () => {
  it('accepts the three modes with their matching column only', () => {
    const db = createTestDb()
    db.insert(recipientLogo)
      .values({ recipientKey: 'rewe', mode: 'brand', brandSlug: 'rewe' })
      .run()
    db.insert(recipientLogo).values({ recipientKey: 'kiosk', mode: 'none' }).run()
    db.insert(recipientLogo)
      .values({ recipientKey: 'baecker', mode: 'upload', fileName: 'a.png' })
      .run()
    expect(db.select().from(recipientLogo).all()).toHaveLength(3)
  })

  it.each([
    [{ recipientKey: 'a', mode: 'brand' }, /recipient_logo_brand/],
    [{ recipientKey: 'b', mode: 'none', brandSlug: 'rewe' }, /recipient_logo_brand/],
    [{ recipientKey: 'c', mode: 'upload' }, /recipient_logo_file/],
    [
      { recipientKey: 'd', mode: 'brand', brandSlug: 'x', fileName: 'a.png' },
      /recipient_logo_file/,
    ],
    [{ recipientKey: '', mode: 'none' }, /recipient_logo_key_len/],
    [{ recipientKey: 'x'.repeat(201), mode: 'none' }, /recipient_logo_key_len/],
    [{ recipientKey: 'e', mode: 'other' }, /recipient_logo_mode/],
  ])('rejects %o', (values, error) => {
    const db = createTestDb()
    expect(() =>
      db
        .insert(recipientLogo)
        .values(values as typeof recipientLogo.$inferInsert)
        .run(),
    ).toThrow(error)
  })

  it('upgrades a 0010 database and keeps bookings', () => {
    const partial = mkdtempSync(join(tmpdir(), 'mig-'))
    cpSync(MIGRATIONS_FOLDER, partial, { recursive: true })
    const journalPath = join(partial, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
    journal.entries = journal.entries.filter((entry) => entry.tag < '0011')
    writeFileSync(journalPath, JSON.stringify(journal))
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const db = drizzle({ client: sqlite })
    migrate(db, { migrationsFolder: partial })
    sqlite.exec(`
      INSERT INTO institution (id, name) VALUES ('in1', 'Bank');
      INSERT INTO account (id, institution_id, name, type) VALUES ('a1', 'in1', 'Giro', 'checking');
      INSERT INTO transactions (id, account_id, booking_date, amount_cents, type, source, fingerprint)
        VALUES ('t1', 'a1', '2026-11-01', -100, 'expense', 'manual', 'f1');
    `)
    runMigrations(db)
    expect(db.select().from(transaction).all()).toHaveLength(1)
    expect(db.select().from(recipientLogo).all()).toEqual([])
  })
})
