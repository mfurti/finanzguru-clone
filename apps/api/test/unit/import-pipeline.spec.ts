import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  account,
  categorizationRule,
  category,
  importJob,
  netWorthSnapshot,
  positionLot,
  transaction,
} from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { ImportPipeline } from '../../src/modules/import/import.pipeline'
import { RecomputeService } from '../../src/modules/import/recompute.service'
import { parseCsv } from '../../src/modules/sources/csv/detector'
import { parseScalable } from '../../src/modules/sources/csv/scalable'
import { parseSparkasse } from '../../src/modules/sources/csv/sparkasse'
import { createTestDb } from '../helpers/test-db'

const fixture = (name: string) => parseCsv(readFileSync(join(__dirname, '../fixtures/csv', name)))

describe('ImportPipeline', () => {
  let db: AppDatabase
  let pipeline: ImportPipeline

  const newJob = () =>
    db.insert(importJob).values({ sourceId: 'csv', kind: 'csv_upload' }).returning().get().id
  const runSparkasse = (name = 'sparkasse-camt-v8.csv') =>
    pipeline.run(parseSparkasse(fixture(name), 'camt'), {
      jobId: newJob(),
      source: 'csv',
      sourceId: 'csv',
    })

  beforeEach(() => {
    db = createTestDb()
    seedDefaults(db)
    pipeline = new ImportPipeline(db, new RecomputeService())
  })

  it('imports a Sparkasse file into a new checking account with snapshots', () => {
    const job = runSparkasse()
    expect(job).toMatchObject({ status: 'succeeded', imported: 8, skipped: 0, failed: 0 })
    const acc = db.select().from(account).where(eq(account.iban, 'DE45120300001234567890')).get()!
    expect(acc.balanceCents).toBe(136777)
    expect(db.select().from(transaction).all()).toHaveLength(8)
    expect(db.select().from(netWorthSnapshot).all().length).toBeGreaterThan(0)
  })

  it('is idempotent: re-importing the same file adds nothing (SC-003)', () => {
    runSparkasse()
    const again = runSparkasse()
    expect(again).toMatchObject({ status: 'succeeded', imported: 0, skipped: 8 })
    expect(db.select().from(transaction).all()).toHaveLength(8)
    expect(db.select().from(account).all()).toHaveLength(1)
  })

  it('keeps valid rows and records row errors as partial', () => {
    const job = pipeline.run(parseSparkasse(fixture('malformed.csv'), 'camt'), {
      jobId: newJob(),
      source: 'csv',
      sourceId: 'csv',
    })
    expect(job).toMatchObject({ status: 'partial', imported: 2, failed: 2 })
    expect(job.errors).toEqual([
      { line: 3, reason: 'invalid_date' },
      { line: 4, reason: 'invalid_amount' },
    ])
  })

  it('applies categorization rules on import', () => {
    const groceries = db.select().from(category).where(eq(category.name, 'Lebenshaltung')).get()!
    db.insert(categorizationRule)
      .values({
        priority: 1,
        matchField: 'counterparty',
        operator: 'contains',
        pattern: 'Supermarkt',
        categoryId: groceries.id,
      })
      .run()
    runSparkasse()
    const categorized = db
      .select()
      .from(transaction)
      .where(eq(transaction.categoryId, groceries.id))
      .all()
    expect(categorized).toHaveLength(2)
    expect(categorized.every((row) => row.categorySource === 'rule')).toBe(true)
  })

  it('imports Scalable trades with instruments, lots and source references', () => {
    const job = pipeline.run(parseScalable(fixture('scalable-transactions.csv')), {
      jobId: newJob(),
      source: 'csv',
      sourceId: 'csv',
    })
    expect(job).toMatchObject({ status: 'partial', imported: 8, failed: 1 })
    expect(db.select().from(positionLot).all().length).toBeGreaterThan(0)
    const depot = db.select().from(account).where(eq(account.type, 'depot')).get()!
    const reference = db.select().from(account).where(eq(account.type, 'reference')).get()!
    expect(reference.parentAccountId).toBe(depot.id)
    // Deposit 500 + interest 0,25 = balance of the new reference account.
    expect(reference.balanceCents).toBe(50025)
    const again = pipeline.run(parseScalable(fixture('scalable-transactions.csv')), {
      jobId: newJob(),
      source: 'csv',
      sourceId: 'csv',
    })
    expect(again).toMatchObject({ imported: 0, skipped: 8 })
  })

  it('imports into a chosen target account without changing its balance', () => {
    const inst = db.select().from(account).all()
    expect(inst).toHaveLength(0)
    runSparkasse()
    const target = db.select().from(account).get()!
    db.update(account).set({ balanceCents: 999 }).where(eq(account.id, target.id)).run()
    pipeline.run(parseSparkasse(fixture('sparkasse-mt940.csv'), 'mt940'), {
      jobId: newJob(),
      source: 'csv',
      sourceId: 'csv',
      targetAccountId: target.id,
    })
    expect(db.select().from(account).where(eq(account.id, target.id)).get()!.balanceCents).toBe(999)
    expect(db.select().from(transaction).all()).toHaveLength(11)
  })

  it('rolls back everything when a batch is inconsistent', () => {
    const batch = parseScalable(fixture('scalable-transactions.csv'))
    // Selling more than was bought makes the FIFO recomputation fail.
    batch.transactions.find((tx) => tx.type === 'sell')!.quantity = '50'
    const job = pipeline.run(batch, { jobId: newJob(), source: 'csv', sourceId: 'csv' })
    expect(job.status).toBe('failed')
    expect(job.errors.at(-1)?.reason).toMatch(/exceeds open quantity/)
    expect(db.select().from(transaction).all()).toHaveLength(0)
    expect(db.select().from(account).all()).toHaveLength(0)
  })
})
