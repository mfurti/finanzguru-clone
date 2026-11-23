/** CLI: `pnpm --filter api db:migrate` applies pending migrations to DATABASE_PATH. */
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runMigrations } from '../database/migrate'
import { openDatabase } from '../database/open-database'

const path = process.env.DATABASE_PATH ?? './data/app.db'
const sqlite = openDatabase(path)
runMigrations(drizzle({ client: sqlite }))
sqlite.close()
console.log(`Migrations applied to ${path}`)
