import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { InvestmentTransactionsResponse } from '@finance/shared'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { instrument, transaction } from '../../src/database/schema'
import { createDemoApp } from '../helpers/demo-app'

describe('Buchungen table (US3)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let depotId: string
  let worldId: string

  beforeAll(async () => {
    let demo
    ;({ app, cookie, demo } = await createDemoApp())
    depotId = demo.depotId
    db = app.get<AppDatabase>(DB)
    worldId = db.select().from(instrument).where(eq(instrument.isin, 'IE00B4L5Y983')).get()!.id
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = (url: string) => app.inject({ method: 'GET', url, headers: { cookie } })

  it('filters by type and instrument and sums all filtered rows', async () => {
    const res = await get(
      `/api/investments/transactions?type=buy&instrumentId=${worldId}&pageSize=5`,
    )
    expect(res.statusCode).toBe(200)
    const body = res.json() as InvestmentTransactionsResponse
    const expected = db
      .select()
      .from(transaction)
      .where(
        and(
          eq(transaction.accountId, depotId),
          eq(transaction.type, 'buy'),
          eq(transaction.instrumentId, worldId),
        ),
      )
      .all()
    expect(body.total).toBe(expected.length)
    expect(body.items).toHaveLength(5)
    expect(body.sumCents).toBe(expected.reduce((sum, tx) => sum + tx.amountCents, 0))
    expect(body.items[0]).toMatchObject({
      type: 'buy',
      accountName: 'Demo Depot',
      isin: 'IE00B4L5Y983',
      wkn: 'A0RPWH',
    })
  })

  it('sorts by date or amount in both directions', async () => {
    const asc = (await get('/api/investments/transactions?sort=date&dir=asc&pageSize=3')).json()
      .items as { bookingDate: string }[]
    expect(asc.map((r) => r.bookingDate)).toEqual([...asc.map((r) => r.bookingDate)].sort())
    const byAmount = (
      await get('/api/investments/transactions?sort=amount&dir=asc&pageSize=3')
    ).json().items as { amountCents: number }[]
    expect(byAmount[0]!.amountCents).toBeLessThanOrEqual(byAmount[1]!.amountCents)
    expect((await get('/api/investments/transactions?sort=name')).statusCode).toBe(400)
  })

  it('exports the filtered rows with the requested columns only', async () => {
    const res = await get(
      `/api/investments/transactions.csv?type=buy&instrumentId=${worldId}&columns=date,name,amount`,
    )
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.body.startsWith('\uFEFF')).toBe(true)
    const lines = res.body.replace('\uFEFF', '').trim().split('\r\n')
    expect(lines[0]).toBe('Datum;Name;Gesamtbetrag')
    const json = (
      await get(`/api/investments/transactions?type=buy&instrumentId=${worldId}&pageSize=200`)
    ).json()
    expect(lines).toHaveLength(1 + json.total)
    // German date and decimal comma, no thousands separator.
    expect(lines[1]).toMatch(
      /^\d{2}\.\d{2}\.\d{4};iShares Core MSCI World UCITS ETF \(Acc\);-\d+,\d{2}$/,
    )
  })

  it('neutralizes spreadsheet formulas in text cells', async () => {
    db.update(instrument).set({ name: '=HYPERLINK("x")' }).where(eq(instrument.id, worldId)).run()
    const res = await get(`/api/investments/transactions.csv?instrumentId=${worldId}&columns=name`)
    expect(res.body.replace('\uFEFF', '').split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")"`)
  })
})
