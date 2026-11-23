import { join, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

/**
 * Folder with the generated SQL migrations: copied next to the compiled code, or
 * MIGRATIONS_FOLDER (dev watch mode reads src/ directly, where new files appear first).
 */
export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER
  ? resolve(process.env.MIGRATIONS_FOLDER)
  : join(__dirname, 'migrations')

/** Applies pending migrations; safe to run on every start. */
export function runMigrations(db: BetterSQLite3Database): void {
  const folder = process.env.MIGRATIONS_FOLDER
    ? resolve(process.env.MIGRATIONS_FOLDER)
    : MIGRATIONS_FOLDER
  migrate(db, { migrationsFolder: folder })
}
