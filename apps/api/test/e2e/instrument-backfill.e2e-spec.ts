import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { count, eq, sum } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, instrumentValueSnapshot, netWorthSnapshot } from '../../src/database/schema'
import { InstrumentBackfillService } from '../../src/modules/import/instrument-backfill.service'
import { createDemoApp } from '../helpers/demo-app'

describe('per-instrument values in the recompute (004 T014)', () => {
  let app: NestFastifyApplication
  let db: AppDatabase

  beforeAll(async () => {
    ;({ app } = await createDemoApp())
    db = app.get<AppDatabase>(DB)
  })

  afterAll(async () => {
    await app?.close()
  })

  const rows = () => db.select({ n: count() }).from(instrumentValueSnapshot).get()!.n

  it('fills the table with the depot recompute; totals match the depot snapshot', () => {
    expect(rows()).toBeGreaterThan(0)
    const depot = db.select().from(account).where(eq(account.type, 'depot')).get()!
    const day = db
      .select()
      .from(netWorthSnapshot)
      .where(eq(netWorthSnapshot.accountId, depot.id))
      .all()
      .at(-1)!
    const total = db
      .select({ value: sum(instrumentValueSnapshot.valueCents) })
      .from(instrumentValueSnapshot)
      .where(eq(instrumentValueSnapshot.date, day.date))
      .get()!
    expect(Number(total.value)).toBe(day.valueCents)
  })

  it('backfills an empty table once', () => {
    db.delete(instrumentValueSnapshot).run()
    const backfill = app.get(InstrumentBackfillService)
    expect(backfill.backfill()).toBeGreaterThan(0)
    expect(rows()).toBeGreaterThan(0)
    expect(backfill.backfill()).toBe(0)
  })
})
