import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type {
  CategoryNode,
  CsvUploadResponse,
  TagDto,
  TransactionBulkResult,
  TransactionPage,
} from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { transaction } from '../../src/database/schema'
import { createDemoApp } from '../helpers/demo-app'
import { multipartBody } from '../helpers/multipart'

describe('transactions bulk actions, delete and undo (003 US1)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const page = async (query: string) =>
    (await call('GET', `/api/transactions?${query}`)).json() as TransactionPage
  const bulk = (payload: object) => call('POST', '/api/transactions/bulk', payload)
  const unreviewedCount = async () =>
    ((await call('GET', '/api/transactions/unreviewed/count')).json() as { count: number }).count

  it('sets a category on two rows and marks them reviewed', async () => {
    const open = await page('review=unreviewed&pageSize=2')
    expect(open.items).toHaveLength(2)
    const before = await unreviewedCount()
    const tree = (await call('GET', '/api/categories')).json() as CategoryNode[]
    const groceries = tree
      .flatMap((main) => [main, ...main.children])
      .find((c) => c.kind === 'expense')!
    const res = await bulk({
      ids: open.items.map((row) => row.id),
      action: 'setCategory',
      value: groceries.id,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ affected: 2 })
    expect(await unreviewedCount()).toBe(before - 2)
    const rows = await page(`categoryIds=${groceries.id}&pageSize=200`)
    for (const id of open.items.map((row) => row.id)) {
      const row = rows.items.find((item) => item.id === id)!
      expect(row).toMatchObject({
        categoryId: groceries.id,
        reviewStatus: 'reviewed',
        categorySource: 'manual',
      })
    }
  })

  it('adds and removes tags in bulk and via PATCH', async () => {
    const urlaub = (await call('POST', '/api/tags', { name: 'Urlaub' })).json() as TagDto
    const rows = (await page('pageSize=3')).items
    const ids = rows.map((row) => row.id)
    expect((await bulk({ ids, action: 'addTags', value: [urlaub.id] })).json()).toEqual({
      affected: 3,
    })
    expect((await page(`tagIds=${urlaub.id}`)).total).toBe(3)
    await bulk({ ids: ids.slice(0, 1), action: 'removeTags', value: [urlaub.id] })
    expect((await page(`tagIds=${urlaub.id}`)).total).toBe(2)
    expect(
      (await call('PATCH', `/api/transactions/${ids[0]}`, { tagIds: [urlaub.id] })).statusCode,
    ).toBe(200)
    expect((await page(`tagIds=${urlaub.id}`)).total).toBe(3)
    expect((await bulk({ ids, action: 'addTags', value: ['missing'] })).statusCode).toBe(400)
  })

  it('marks everything matching a filter as reviewed and leaves the rest', async () => {
    const before = await page('pageSize=1')
    const filter = { review: 'unreviewed', from: '2026-10-01', to: '2026-10-31' }
    const target = (await page('review=unreviewed&from=2026-10-01&to=2026-10-31&pageSize=1')).total
    const res = await bulk({ filter, action: 'markReviewed' })
    expect(res.json()).toEqual({ affected: target })
    expect((await page('review=unreviewed&from=2026-10-01&to=2026-10-31&pageSize=1')).total).toBe(0)
    expect((await page('pageSize=1')).total).toBe(before.total)
  })

  it('validates ids XOR filter and returns 0 for an empty match', async () => {
    expect((await bulk({ action: 'markReviewed' })).statusCode).toBe(400)
    expect(
      (await bulk({ ids: ['x'], filter: { q: 'a' }, action: 'markReviewed' })).statusCode,
    ).toBe(400)
    expect((await bulk({ filter: { q: 'kein-treffer-xyz' }, action: 'delete' })).json()).toEqual({
      affected: 0,
    })
    expect((await bulk({ filter: { from: 'bad' }, action: 'delete' })).statusCode).toBe(400)
  })

  it('deletes rows in bulk and restores them with the undo token', async () => {
    const total = (await page('pageSize=1')).total
    const ids = (await page('pageSize=4')).items.map((row) => row.id)
    const deleted = (await bulk({ ids, action: 'delete' })).json() as TransactionBulkResult
    expect(deleted.affected).toBe(4)
    expect((await page('pageSize=1')).total).toBe(total - 4)
    const restored = await call('POST', '/api/transactions/restore', {
      undoToken: deleted.undoToken,
    })
    expect(restored.json()).toEqual({ restored: 4 })
    expect((await page('pageSize=1')).total).toBe(total)
    expect(
      (await call('POST', '/api/transactions/restore', { undoToken: deleted.undoToken }))
        .statusCode,
    ).toBe(410)
  })

  it('deletes a single row and 404s for unknown ids', async () => {
    const id = (await page('pageSize=1')).items[0]!.id
    const res = await call('DELETE', `/api/transactions/${id}`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('undoToken')
    expect((await call('DELETE', `/api/transactions/${id}`)).statusCode).toBe(404)
  })

  it('does not bring deleted imported rows back on re-import (FR-007)', async () => {
    const file = readFileSync(join(__dirname, '../fixtures/csv', 'sparkasse-camt-v8.csv'))
    const importFile = async () => {
      const body = await multipartBody(file, 'konto.csv')
      const uploaded = (
        await app.inject({
          method: 'POST',
          url: '/api/import/csv',
          headers: { ...body.headers, cookie },
          payload: body.payload,
        })
      ).json() as CsvUploadResponse
      return (await call('POST', `/api/import/csv/${uploaded.jobId}/confirm`, {})).json() as {
        imported: number
        skipped: number
        accountIds?: string[]
      }
    }
    expect(await importFile()).toMatchObject({ imported: 8 })
    const victims = app
      .get<AppDatabase>(DB)
      .select({ id: transaction.id })
      .from(transaction)
      .where(eq(transaction.source, 'csv'))
      .limit(2)
      .all()
      .map((row) => row.id)
    expect(victims).toHaveLength(2)
    await bulk({ ids: victims, action: 'delete' })
    // 6 rows still exist and 2 are remembered as deleted: all 8 are skipped.
    expect(await importFile()).toMatchObject({ imported: 0, skipped: 8 })
    for (const id of victims) {
      expect((await page('pageSize=200')).items.some((row) => row.id === id)).toBe(false)
    }
  })
})
