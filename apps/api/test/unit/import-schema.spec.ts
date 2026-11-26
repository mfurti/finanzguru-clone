import { beforeEach, describe, expect, it } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { categorizationRule, category, csvMapping, importJob } from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { createTestDb } from '../helpers/test-db'

describe('import tables', () => {
  let db: AppDatabase
  let categoryId: string

  beforeEach(() => {
    db = createTestDb()
    seedDefaults(db)
    categoryId = db.select().from(category).get()!.id
  })

  it('creates import jobs with defaults', () => {
    const job = db
      .insert(importJob)
      .values({ sourceId: 'csv', kind: 'csv_upload' })
      .returning()
      .get()
    expect(job).toMatchObject({ status: 'pending', imported: 0, skipped: 0, failed: 0, errors: [] })
    expect(() =>
      // @ts-expect-error invalid status on purpose
      db.insert(importJob).values({ sourceId: 'csv', kind: 'csv_upload', status: 'done' }).run(),
    ).toThrow(/import_job_status/)
  })

  it('keeps CSV mappings unique per header signature', () => {
    const mapping = {
      name: 'Bank X',
      headerSignature: 'abc',
      delimiter: ',',
      encoding: 'utf-8',
      dateFormat: 'YYYY-MM-DD',
      decimalSeparator: '.',
      columns: { date: 0, amount: 1 },
    }
    db.insert(csvMapping).values(mapping).run()
    expect(() =>
      db
        .insert(csvMapping)
        .values({ ...mapping, name: 'dup' })
        .run(),
    ).toThrow(/UNIQUE/)
  })

  it('enforces unique rule priorities and valid operators', () => {
    db.insert(categorizationRule)
      .values({
        priority: 1,
        matchField: 'counterparty',
        operator: 'contains',
        pattern: 'REWE',
        categoryId,
      })
      .run()
    expect(() =>
      db
        .insert(categorizationRule)
        .values({
          priority: 1,
          matchField: 'purpose',
          operator: 'equals',
          pattern: 'x',
          categoryId,
        })
        .run(),
    ).toThrow(/UNIQUE/)
    expect(() =>
      db
        .insert(categorizationRule)
        // @ts-expect-error invalid operator on purpose
        .values({ priority: 2, matchField: 'purpose', operator: 'like', pattern: 'x', categoryId })
        .run(),
    ).toThrow(/categorization_rule_operator/)
  })
})
