import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

/** Folder with the generated SQL migrations (copied next to the compiled code). */
export const MIGRATIONS_FOLDER = join(__dirname, 'migrations')

/** Applies pending migrations; safe to run on every start. */
export function runMigrations(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
