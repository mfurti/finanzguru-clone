/**
 * CLI: `pnpm --filter api db:seed [-- --demo]`
 * Applies migrations, the default data and, with --demo, the synthetic demo dataset.
 */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runMigrations } from '../database/migrate'
import { openDatabase } from '../database/open-database'
import { seedDemo } from '../database/demo'
import { seedDefaults } from '../database/seed'

function main(): void {
  const path = process.env.DATABASE_PATH ?? './data/app.db'
  const sqlite = openDatabase(path)
  const db = drizzle({ client: sqlite })
  runMigrations(db)
  seedDefaults(db)
  if (process.argv.includes('--demo')) {
    const result = seedDemo(db)
    console.log(`Demo data: ${result.transactions} transactions, ${result.prices} prices`)
  }
  sqlite.close()
  console.log(`Seed applied to ${path}`)
}

try {
  main()
} catch (error: unknown) {
  console.error(error)
  process.exitCode = 1
}
