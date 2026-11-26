import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from '../../src/database/open-database'

describe('openDatabase', () => {
  it('creates the parent folder and enables WAL + foreign keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'finance-db-'))
    const db = openDatabase(join(dir, 'nested', 'app.db'))
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    db.close()
  })
})
