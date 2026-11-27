import { beforeEach, describe, expect, it } from 'vitest'
import { emptyBatch, type SyncBatch } from '@finance/shared'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, importJob } from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { ImportPipeline } from '../../src/modules/import/import.pipeline'
import { RecomputeService } from '../../src/modules/import/recompute.service'
import { createTestDb } from '../helpers/test-db'

/** 013 T005: previous source balance + bookings imported since = reported balance. */
describe('balance check on sync', () => {
  let db: AppDatabase
  let pipeline: ImportPipeline

  beforeEach(() => {
    db = createTestDb()
    seedDefaults(db)
    pipeline = new ImportPipeline(db, new RecomputeService())
  })

  const sync = (balanceCents: number, bookings: [string, number][]) => {
    const batch: SyncBatch = {
      ...emptyBatch(),
      accounts: [
        {
          externalRef: 'giro',
          name: 'Giro',
          type: 'checking',
          institutionName: 'Testbank',
          balanceCents,
        },
      ],
      transactions: bookings.map(([date, amountCents], i) => ({
        accountExternalRef: 'giro',
        sourceRef: `${date}-${i}-${amountCents}`,
        bookingDate: date,
        amountCents,
        type: amountCents < 0 ? 'expense' : 'income',
        counterparty: `Gegenpartei ${i}`,
      })),
    }
    const jobId = db
      .insert(importJob)
      .values({ sourceId: 'csv', kind: 'csv_upload' })
      .returning()
      .get().id
    pipeline.run(batch, { jobId, source: 'csv', sourceId: 'csv' })
    return db.select().from(account).get()!
  }

  it('has nothing to compare on the first sync', () => {
    const giro = sync(100_000, [['2026-11-01', 100_000]])
    expect(giro).toMatchObject({ sourceBalanceCents: 100_000, balanceDiffCents: null })
  })

  it('is 0 when the new bookings explain the new balance', () => {
    sync(100_000, [['2026-11-01', 100_000]])
    const giro = sync(97_500, [['2026-11-05', -2_500]])
    expect(giro).toMatchObject({ sourceBalanceCents: 97_500, balanceDiffCents: 0 })
  })

  it('shows the difference when a booking is missing', () => {
    sync(100_000, [['2026-11-01', 100_000]])
    const giro = sync(95_000, [['2026-11-05', -2_500]])
    expect(giro.balanceDiffCents).toBe(-2_500)
  })
})
