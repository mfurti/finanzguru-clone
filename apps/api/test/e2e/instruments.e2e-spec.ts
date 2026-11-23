import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { instrument, price } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('instruments and manual prices (T007)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    db = app.get<AppDatabase>(DB)
  })

  afterAll(async () => {
    await app?.close()
  })

  const post = (url: string, payload: object) =>
    app.inject({ method: 'POST', url, headers: { cookie }, payload })

  it('creates a benchmark instrument and rejects duplicates and bad ISINs', async () => {
    const created = await post('/api/instruments', {
      isin: 'ie00b5bmr087',
      name: 'S&P 500 ETF',
      assetClass: 'etf',
      isBenchmark: true,
    })
    expect(created.statusCode).toBe(201)
    const row = db.select().from(instrument).where(eq(instrument.isin, 'IE00B5BMR087')).get()!
    expect(row).toMatchObject({ isBenchmark: true, fundType: 'equity' })

    expect((await post('/api/instruments', { isin: 'IE00B5BMR087', name: 'X' })).statusCode).toBe(
      409,
    )
    expect((await post('/api/instruments', { isin: 'IE00B5BMR088', name: 'X' })).statusCode).toBe(
      400,
    )
  })

  it('upserts manual prices, one row per day', async () => {
    const id = db.select().from(instrument).where(eq(instrument.isin, 'IE00B5BMR087')).get()!.id
    const first = await post(`/api/instruments/${id}/prices`, {
      prices: [
        { date: '2026-01-02', close: '100' },
        { date: '2026-01-05', close: '101.5' },
      ],
    })
    expect(first.statusCode).toBe(201)
    await post(`/api/instruments/${id}/prices`, { prices: [{ date: '2026-01-05', close: '102' }] })
    const rows = db.select().from(price).where(eq(price.instrumentId, id)).all()
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.date === '2026-01-05')).toMatchObject({
      close: '102',
      source: 'manual',
    })
  })

  it('validates prices and unknown instruments', async () => {
    expect(
      (await post('/api/instruments/nope/prices', { prices: [{ date: '2026-01-02', close: '1' }] }))
        .statusCode,
    ).toBe(404)
    const id = db.select().from(instrument).get()!.id
    expect(
      (
        await post(`/api/instruments/${id}/prices`, {
          prices: [{ date: '2026-01-02', close: '0' }],
        })
      ).statusCode,
    ).toBe(400)
  })

  it('requires a session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/instruments', payload: {} })
    expect(res.statusCode).toBe(401)
  })
})
