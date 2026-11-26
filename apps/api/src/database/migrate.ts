import { join, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type Database from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

/**
 * Folder with the generated SQL migrations: copied next to the compiled code, or
 * MIGRATIONS_FOLDER (dev watch mode reads src/ directly, where new files appear first).
 */
export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER
  ? resolve(process.env.MIGRATIONS_FOLDER)
  : join(__dirname, 'migrations')

/**
 * Applies pending migrations; safe to run on every start.
 *
 * Foreign keys are switched off while migrating: a migration that rebuilds a table to change a
 * CHECK (e.g. 0008) drops the old table, and with foreign keys on that drop would cascade into
 * child rows. The pragma has no effect inside the migrator's transaction, so it is set here.
 * Afterwards `foreign_key_check` must be empty, else the start fails.
 */
export function runMigrations(db: BetterSQLite3Database & { $client: Database.Database }): void {
  const folder = process.env.MIGRATIONS_FOLDER
    ? resolve(process.env.MIGRATIONS_FOLDER)
    : MIGRATIONS_FOLDER
  const client = db.$client
  const foreignKeys = client.pragma('foreign_keys', { simple: true }) === 1
  client.pragma('foreign_keys = OFF')
  try {
    migrate(db, { migrationsFolder: folder })
    const violations = client.pragma('foreign_key_check') as unknown[]
    if (violations.length > 0) {
      throw new Error(`Migration left ${violations.length} foreign key violation(s)`)
    }
  } finally {
    if (foreignKeys) client.pragma('foreign_keys = ON')
  }
}
