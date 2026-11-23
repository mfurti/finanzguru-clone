import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runMigrations } from '../../src/database/migrate'
import { openDatabase } from '../../src/database/open-database'
import type { AppDatabase } from '../../src/database/drizzle.module'

/** Fresh in-memory database with all migrations applied. */
export function createTestDb(): AppDatabase {
  const db = drizzle({ client: openDatabase(':memory:') })
  runMigrations(db)
  return db
}
