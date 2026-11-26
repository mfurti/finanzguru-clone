import type { DataSource, SyncBatch } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, dataSource, syncRun, transaction } from '../../src/database/schema'
import { ImportPipeline } from '../../src/modules/import/import.pipeline'
import { RecomputeService } from '../../src/modules/import/recompute.service'
import { AuthExpiredError, UpstreamError } from '../../src/modules/sources/errors'
import { SourcesRegistry } from '../../src/modules/sources/sources.registry'
import { SyncService } from '../../src/modules/sources/sync.service'
import { createTestDb } from '../helpers/test-db'

/** Fake Scalable source whose next result the test controls. */
class FakeSource implements DataSource {
  readonly kind = 'scalable_mcp' as const
  next: () => Promise<SyncBatch> = async () => batch()
  status = async () => 'active' as const
  fetch = () => this.next()
}

function batch(extra: Partial<SyncBatch> = {}): SyncBatch {
  return {
    accounts: [
      {
        externalRef: 'ref-1',
        name: 'Scalable Verrechnungskonto',
        type: 'checking',
        institutionName: 'Scalable Capital',
        balanceCents: 10_000,
      },
    ],
    instruments: [],
    transactions: [
      {
        accountExternalRef: 'ref-1',
        sourceRef: 'tx-1',
        bookingDate: '2026-11-02',
        amountCents: 10_000,
        type: 'deposit',
        purpose: 'Einzahlung',
      },
    ],
    prices: [],
    rowErrors: [],
    ...extra,
  }
}

describe('SyncService (004 US1)', () => {
  let db: AppDatabase
  let fake: FakeSource
  let sync: SyncService

  beforeEach(() => {
    db = createTestDb()
    db.insert(dataSource)
      .values({ id: 'scalable', kind: 'scalable_mcp', status: 'active', displayName: 'Scalable' })
      .onConflictDoNothing()
      .run()
    fake = new FakeSource()
    sync = new SyncService(
      db,
      new SourcesRegistry([fake]),
      new ImportPipeline(db, new RecomputeService()),
    )
  })

  it('imports a batch, logs the run and stamps the last sync', async () => {
    const outcome = await sync.run('scalable')
    expect(outcome).toMatchObject({ status: 'succeeded', imported: 1, skipped: 0 })
    const run = db.select().from(syncRun).where(eq(syncRun.id, outcome.runId)).get()!
    expect(run).toMatchObject({ status: 'succeeded', imported: 1 })
    expect(run.finishedAt).not.toBeNull()
    const source = db.select().from(dataSource).where(eq(dataSource.id, 'scalable')).get()!
    expect(source).toMatchObject({ status: 'active', lastError: null })
    expect(source.lastSyncAt).not.toBeNull()
    expect(db.select().from(account).get()!.lastSyncedAt).not.toBeNull()
  })

  it('does not import the same bookings twice', async () => {
    await sync.run('scalable')
    const again = await sync.run('scalable')
    expect(again).toMatchObject({ imported: 0, skipped: 1 })
    expect(db.select().from(transaction).all()).toHaveLength(1)
  })

  it('refuses a second start while one runs', async () => {
    let release!: () => void
    fake.next = () => new Promise((resolve) => (release = () => resolve(batch())))
    const first = sync.start('scalable')
    expect(sync.isRunning('scalable')).toBe(true)
    expect(() => sync.start('scalable')).toThrow(/läuft bereits/)
    release()
    await first.done
    expect(sync.isRunning('scalable')).toBe(false)
  })

  it('marks an expired grant as needs_reauth and keeps the data', async () => {
    await sync.run('scalable')
    fake.next = async () => {
      throw new AuthExpiredError()
    }
    const outcome = await sync.run('scalable')
    expect(outcome.status).toBe('failed')
    const source = db.select().from(dataSource).where(eq(dataSource.id, 'scalable')).get()!
    expect(source.status).toBe('needs_reauth')
    expect(db.select().from(transaction).all()).toHaveLength(1)
  })

  it('marks upstream errors as error without leaking tokens; next good sync recovers', async () => {
    fake.next = async () => {
      throw new UpstreamError('bad gateway token=abc123secret')
    }
    const failed = await sync.run('scalable')
    expect(failed.error).not.toContain('abc123secret')
    expect(db.select().from(dataSource).where(eq(dataSource.id, 'scalable')).get()!.status).toBe(
      'error',
    )
    fake.next = async () => batch()
    await sync.run('scalable')
    expect(db.select().from(dataSource).where(eq(dataSource.id, 'scalable')).get()!.status).toBe(
      'active',
    )
  })

  it('reports partial runs and refuses CSV sources', async () => {
    fake.next = async () => batch({ rowErrors: [{ reason: 'Zeile kaputt' }] })
    expect((await sync.run('scalable')).status).toBe('partial')
    db.insert(dataSource)
      .values({ id: 'csv', kind: 'csv', status: 'active', displayName: 'CSV-Import' })
      .onConflictDoNothing()
      .run()
    expect(() => sync.start('csv')).toThrow(/Import/)
    expect(() => sync.start('missing')).toThrow(/nicht gefunden/)
  })
})
