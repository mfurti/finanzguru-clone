import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, dataSource, importJob, transaction } from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { findBankMatch } from '../../src/domain/bank-match'
import { ImportPipeline } from '../../src/modules/import/import.pipeline'
import { RecomputeService } from '../../src/modules/import/recompute.service'
import { parseCsv } from '../../src/modules/sources/csv/detector'
import { parseSparkasse } from '../../src/modules/sources/csv/sparkasse'
import { emptyBatch, type SyncBatch } from '../../src/modules/sources/data-source.interface'
import { createTestDb } from '../helpers/test-db'

describe('findBankMatch (005 R2)', () => {
  const row = (id: string, bookingDate: string, amountCents: number, counterparty?: string) => ({
    id,
    bookingDate,
    amountCents,
    counterparty,
  })

  it('links the single row with the same amount within ±1 day', () => {
    const item = { bookingDate: '2026-11-03', amountCents: -5499 }
    expect(findBankMatch(item, [row('a', '2026-11-02', -5499)])).toBe('a')
    expect(findBankMatch(item, [row('a', '2026-11-05', -5499)])).toBeUndefined()
    expect(findBankMatch(item, [row('a', '2026-11-03', -5498)])).toBeUndefined()
  })

  it('breaks ties by counterparty, then by exact date', () => {
    const item = { bookingDate: '2026-11-03', amountCents: -1000, counterparty: 'REWE' }
    expect(
      findBankMatch(item, [
        row('a', '2026-11-03', -1000, 'Aldi'),
        row('b', '2026-11-03', -1000, 'REWE Markt GmbH'),
      ]),
    ).toBe('b')
    expect(
      findBankMatch({ bookingDate: '2026-11-03', amountCents: -1000 }, [
        row('a', '2026-11-02', -1000),
        row('b', '2026-11-03', -1000),
      ]),
    ).toBe('b')
  })

  it('gives up when two rows stay equally likely', () => {
    expect(
      findBankMatch({ bookingDate: '2026-11-03', amountCents: -1000 }, [
        row('a', '2026-11-03', -1000),
        row('b', '2026-11-03', -1000),
      ]),
    ).toBeUndefined()
  })
})

describe('ImportPipeline with matchExisting (005 T011)', () => {
  let db: AppDatabase
  let pipeline: ImportPipeline

  beforeEach(() => {
    db = createTestDb()
    seedDefaults(db)
    db.insert(dataSource)
      .values({ id: 'enable_banking', kind: 'enable_banking', status: 'active', displayName: 'B' })
      .run()
    pipeline = new ImportPipeline(db, new RecomputeService())
    const csv = parseCsv(readFileSync(join(__dirname, '../fixtures/csv', 'sparkasse-camt-v8.csv')))
    const job = db
      .insert(importJob)
      .values({ sourceId: 'csv', kind: 'csv_upload' })
      .returning()
      .get().id
    pipeline.run(parseSparkasse(csv, 'camt'), { jobId: job, source: 'csv', sourceId: 'csv' })
  })

  /** Live copy of the CSV rows with other texts and a shifted date for the first one. */
  function liveBatch(): SyncBatch {
    const acc = db.select().from(account).get()!
    const rows = db.select().from(transaction).all()
    const batch = emptyBatch()
    batch.accounts.push({
      externalRef: 'eb:u1',
      name: 'Girokonto',
      type: 'checking',
      iban: acc.iban!,
      institutionName: 'Sparkasse',
      balanceCents: acc.balanceCents,
    })
    rows.forEach((tx, index) => {
      const date = new Date(`${tx.bookingDate}T00:00:00Z`)
      if (index === 0) date.setUTCDate(date.getUTCDate() + 1)
      batch.transactions.push({
        accountExternalRef: 'eb:u1',
        sourceRef: `ref-${index}`,
        bookingDate: date.toISOString().slice(0, 10),
        amountCents: tx.amountCents,
        type: tx.amountCents < 0 ? 'expense' : 'income',
        counterparty: tx.counterparty ?? undefined,
        purpose: `PSD2 text ${index}`,
      })
    })
    batch.transactions.push({
      accountExternalRef: 'eb:u1',
      sourceRef: 'ref-new',
      bookingDate: '2026-11-20',
      amountCents: -777,
      type: 'expense',
      purpose: 'Neu',
    })
    return batch
  }

  const runLive = (batch: SyncBatch) => {
    const job = db
      .insert(importJob)
      .values({ sourceId: 'enable_banking', kind: 'sync' })
      .returning()
      .get().id
    return pipeline.run(batch, {
      jobId: job,
      source: 'enable_banking',
      sourceId: 'enable_banking',
      matchExisting: true,
    })
  }

  it('links CSV rows instead of duplicating them and adds only the new booking', () => {
    const before = db.select().from(transaction).all().length
    const batch = liveBatch()
    expect(runLive(batch)).toMatchObject({ imported: 1, skipped: before })
    const rows = db.select().from(transaction).all()
    expect(rows).toHaveLength(before + 1)
    expect(rows.every((tx) => tx.source === 'enable_banking' && tx.sourceRef)).toBe(true)
    // The CSV texts stay; only the reference is added.
    expect(rows.some((tx) => tx.purpose?.startsWith('PSD2 text'))).toBe(false)
    expect(runLive(batch)).toMatchObject({ imported: 0, skipped: before + 1 })
    expect(
      db.select().from(transaction).where(eq(transaction.sourceRef, 'ref-new')).all(),
    ).toHaveLength(1)
  })
})
