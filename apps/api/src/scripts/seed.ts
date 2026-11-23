/**
 * CLI: `pnpm --filter api db:seed`
 * Applies migrations and the default data.
 */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runMigrations } from '../database/migrate'
import { openDatabase } from '../database/open-database'
import { seedDefaults } from '../database/seed'

async function main(): Promise<void> {
  const path = process.env.DATABASE_PATH ?? './data/app.db'
  const sqlite = openDatabase(path)
  const db = drizzle({ client: sqlite })
  runMigrations(db)
  seedDefaults(db)
  sqlite.close()
  console.log(`Seed applied to ${path}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
