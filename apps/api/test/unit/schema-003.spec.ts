import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER } from '../../src/database/migrate'
import { tag } from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('feature 003 schema (migration 0006)', () => {
  it('keeps tag names unique regardless of case and within 1–40 chars', () => {
    const db = createTestDb()
    db.insert(tag).values({ name: 'Urlaub' }).run()
    expect(() => db.insert(tag).values({ name: 'urlaub' }).run()).toThrow(/UNIQUE/)
    expect(() => db.insert(tag).values({ name: '' }).run()).toThrow(/tag_name_len/)
    expect(() =>
      db
        .insert(tag)
        .values({ name: 'x'.repeat(41) })
        .run(),
    ).toThrow(/tag_name_len/)
  })

  it('upgrades a 0005 database additively: bookings kept, icon defaults to tag', () => {
    const partial = mkdtempSync(join(tmpdir(), 'mig-'))
    cpSync(MIGRATIONS_FOLDER, partial, { recursive: true })
    const journalPath = join(partial, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
    journal.entries = journal.entries.filter((entry) => entry.tag < '0006')
    writeFileSync(journalPath, JSON.stringify(journal))

    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const old = drizzle({ client: sqlite })
    migrate(old, { migrationsFolder: partial })
    sqlite.exec(`
      INSERT INTO institution (id, name) VALUES ('in1', 'Bank');
      INSERT INTO account (id, institution_id, name, type) VALUES ('a1', 'in1', 'Giro', 'checking');
      INSERT INTO category (id, name, kind) VALUES ('c1', 'Wohnen', 'expense');
      INSERT INTO transactions (id, account_id, booking_date, amount_cents, type, source, fingerprint, category_id)
        VALUES ('t1', 'a1', '2026-01-02', -1000, 'expense', 'manual', 'f1', 'c1');
    `)

    migrate(old, { migrationsFolder: MIGRATIONS_FOLDER })
    expect(sqlite.prepare('SELECT id FROM transactions').all()).toEqual([{ id: 't1' }])
    expect(sqlite.prepare('SELECT icon FROM category').get()).toEqual({ icon: 'tag' })
  })
})
