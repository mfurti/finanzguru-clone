import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TransactionListItem, TransactionPage } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { DemoResult } from '../../src/database/demo'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { tag, transactionTag } from '../../src/database/schema'
import { createDemoApp } from '../helpers/demo-app'

describe('transactions query (003 R1)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let demo: DemoResult

  beforeAll(async () => {
    ;({ app, cookie, demo } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const page = async (query: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/transactions?${query}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    return res.json() as TransactionPage
  }
  const status = async (query: string) =>
    (await app.inject({ method: 'GET', url: `/api/transactions?${query}`, headers: { cookie } }))
      .statusCode
  const all = async (query: string) => (await page(`${query}&pageSize=200`)).items

  it('returns paging info and the sum of all matching rows', async () => {
    const first = await page('pageSize=25')
    expect(first.page).toBe(1)
    expect(first.pageSize).toBe(25)
    expect(first.items.length).toBeLessThanOrEqual(25)
    expect(first.total).toBeGreaterThan(25)
    const october = await all('from=2026-10-01&to=2026-10-31')
    const sum = (await page('from=2026-10-01&to=2026-10-31&pageSize=1')).sumCents
    expect(sum).toBe(october.reduce((acc, row) => acc + row.amountCents, 0))
  })

  it('accepts page sizes 25, 50, 100 and rejects sizes above 200', async () => {
    for (const size of [25, 50, 100]) expect(await status(`pageSize=${size}`)).toBe(200)
    expect(await status('pageSize=500')).toBe(400)
    expect(await status('sort=nope')).toBe(400)
    expect(await status('from=2026-10-31&to=2026-10-01')).toBe(400)
  })

  it('filters by account, type list, amount range, date and search', async () => {
    const giro = await all(`accounts=${demo.checkingId}`)
    expect(giro.every((row) => row.accountId === demo.checkingId)).toBe(true)
    const types = await all('types=income,expense')
    expect(new Set(types.map((row) => row.type))).toEqual(new Set(['income', 'expense']))
    const big = await all('minCents=-100000&maxCents=-50000')
    expect(big.length).toBeGreaterThan(0)
    expect(big.every((row) => row.amountCents >= -100000 && row.amountCents <= -50000)).toBe(true)
    const dated = await all('from=2026-10-01&to=2026-10-31')
    expect(
      dated.every((row) => row.bookingDate >= '2026-10-01' && row.bookingDate <= '2026-10-31'),
    ).toBe(true)
    const hits = await all('q=Hausverwaltung')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('filters by category (incl. sub categories), tags and review state', async () => {
    const withCategory = (await all('from=2026-10-01')).find((row) => row.categoryId)!
    const byCategory = await all(`categoryIds=${withCategory.categoryId}`)
    expect(byCategory.map((row) => row.id)).toContain(withCategory.id)

    const db = app.get<AppDatabase>(DB)
    const urlaub = db.insert(tag).values({ name: 'Urlaub', color: 'sky' }).returning().get()
    db.insert(transactionTag).values({ transactionId: withCategory.id, tagId: urlaub.id }).run()
    const tagged = await all(`tagIds=${urlaub.id}`)
    expect(tagged.map((row) => row.id)).toEqual([withCategory.id])
    expect(tagged[0]!.tags).toEqual([{ id: urlaub.id, name: 'Urlaub', color: 'sky' }])

    const unreviewed = await all('review=unreviewed')
    expect(unreviewed.length).toBeGreaterThan(0)
    expect(unreviewed.every((row) => row.reviewStatus === 'unreviewed' && !row.categoryId)).toBe(
      true,
    )
    const reviewed = await page('review=reviewed&pageSize=1')
    expect(reviewed.total + (await page('review=unreviewed&pageSize=1')).total).toBe(
      (await page('pageSize=1')).total,
    )
    const count = await app.inject({
      method: 'GET',
      url: '/api/transactions/unreviewed/count',
      headers: { cookie },
    })
    expect(count.json()).toEqual({ count: (await page('review=unreviewed')).total })
  })

  it('sorts every column in both directions with a stable order', async () => {
    const key: Record<string, (row: TransactionListItem) => string | number> = {
      date: (row) => row.bookingDate,
      amount: (row) => row.amountCents,
      counterparty: (row) => (row.counterparty ?? '').toLowerCase(),
      category: (row) => (row.categoryName ?? '').toLowerCase(),
      account: (row) => row.accountName.toLowerCase(),
    }
    for (const [sort, get] of Object.entries(key)) {
      for (const dir of ['asc', 'desc'] as const) {
        const rows = await all(`sort=${sort}&dir=${dir}`)
        const values = rows.map(get)
        const sorted = [...values].sort(
          (a, b) => (a < b ? -1 : a > b ? 1 : 0) * (dir === 'asc' ? 1 : -1),
        )
        expect(values, `${sort} ${dir}`).toEqual(sorted)
      }
    }
    const a = await page('sort=amount&pageSize=25&page=1')
    const b = await page('sort=amount&pageSize=25&page=2')
    const ids = new Set(a.items.map((row) => row.id))
    expect(b.items.some((row) => ids.has(row.id))).toBe(false)
  })
})
