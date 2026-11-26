import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER, runMigrations } from '../../src/database/migrate'
import { account, institution, tag, transaction, transactionTag } from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('feature 007 schema (migration 0010)', () => {
  it('limits notes to 1 000 characters', () => {
    const db = createTestDb()
    const inst = db.insert(institution).values({ name: 'Bank' }).returning().get()
    const acc = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Giro', type: 'checking' })
      .returning()
      .get()
    const base = {
      accountId: acc.id,
      bookingDate: '2026-11-01',
      amountCents: -100,
      type: 'expense' as const,
      source: 'manual' as const,
    }
    db.insert(transaction)
      .values({ ...base, fingerprint: 'a', note: 'x'.repeat(1000) })
      .run()
    expect(() =>
      db
        .insert(transaction)
        .values({ ...base, fingerprint: 'b', note: 'x'.repeat(1001) })
        .run(),
    ).toThrow(/transactions_note_len/)
  })

  it('upgrades a 0009 database and keeps bookings and their tags', () => {
    const partial = mkdtempSync(join(tmpdir(), 'mig-'))
    cpSync(MIGRATIONS_FOLDER, partial, { recursive: true })
    const journalPath = join(partial, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
    journal.entries = journal.entries.filter((entry) => entry.tag < '0010')
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
      INSERT INTO tag (id, name) VALUES ('g1', 'Urlaub');
      INSERT INTO transaction_tag (transaction_id, tag_id) VALUES ('t1', 'g1');
    `)
    runMigrations(db)
    expect(db.select().from(transaction).all()).toHaveLength(1)
    expect(db.select().from(transactionTag).all()).toHaveLength(1)
    expect(db.select().from(tag).all()).toHaveLength(1)
    expect(db.select().from(transaction).get()!.note).toBeNull()
  })
})
