/**
 * Full rebuild of all derived values (`pnpm --filter api recompute:all`).
 *
 * Needed once after upgrading to 010: broker reference accounts now include the depot's trade
 * cash legs (R3), which changes their whole history. Normal syncs and imports only rebuild
 * from the changed day on.
 */
import { NestFactory } from '@nestjs/core'
import { account } from '../database/schema'

async function main(): Promise<void> {
  process.env.LOG_LEVEL ??= 'silent'
  const { AppModule } = await import('../app.module.js')
  const { RecomputeService } = await import('../modules/import/recompute.service.js')
  const { DB } = await import('../database/database.constants.js')
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] })
  const db = app.get(DB) as import('../database/drizzle.module').AppDatabase
  const ids = db
    .select({ id: account.id })
    .from(account)
    .all()
    .map((row) => row.id)
  db.transaction((tx) => app.get(RecomputeService).recompute(tx, ids))
  console.log(`Neu berechnet: ${ids.length} Konten`)
  await app.close()
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
