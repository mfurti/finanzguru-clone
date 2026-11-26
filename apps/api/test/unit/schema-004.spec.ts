import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS_FOLDER } from '../../src/database/migrate'
import { dataSource, syncRun } from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('feature 004 schema (migration 0007)', () => {
  it('constrains sync runs', () => {
    const db = createTestDb()
    db.insert(dataSource)
      .values({ id: 'scalable', kind: 'scalable_mcp', status: 'planned', displayName: 'Scalable' })
      .onConflictDoNothing()
      .run()
    db.insert(syncRun).values({ sourceId: 'scalable', status: 'running' }).run()
    expect(() =>
      db
        .insert(syncRun)
        .values({ sourceId: 'scalable', status: 'bogus' as never })
        .run(),
    ).toThrow(/sync_run_status/)
    expect(() =>
      db.insert(syncRun).values({ sourceId: 'scalable', status: 'failed', imported: -1 }).run(),
    ).toThrow(/sync_run_counts/)
    expect(() =>
      db
        .insert(syncRun)
        .values({ sourceId: 'scalable', status: 'failed', error: 'x'.repeat(501) })
        .run(),
    ).toThrow(/sync_run_error_len/)
  })

  it('upgrades a 0006 database additively', () => {
    const partial = mkdtempSync(join(tmpdir(), 'mig-'))
    cpSync(MIGRATIONS_FOLDER, partial, { recursive: true })
    const journalPath = join(partial, 'meta', '_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
    journal.entries = journal.entries.filter((entry) => entry.tag < '0007')
    writeFileSync(journalPath, JSON.stringify(journal))
    const sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
    const old = drizzle({ client: sqlite })
    migrate(old, { migrationsFolder: partial })
    sqlite.exec(`INSERT INTO institution (id, name) VALUES ('in1', 'Bank');`)
    migrate(old, { migrationsFolder: MIGRATIONS_FOLDER })
    expect(sqlite.prepare('SELECT count(*) AS n FROM institution').get()).toEqual({ n: 1 })
    expect(sqlite.prepare('SELECT count(*) AS n FROM instrument_value_snapshot').get()).toEqual({
      n: 0,
    })
  })
})
