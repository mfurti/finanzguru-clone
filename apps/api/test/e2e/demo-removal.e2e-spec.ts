import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  account,
  institution,
  instrument,
  price,
  transaction,
  watchlist,
} from '../../src/database/schema'
import { createDemoApp } from '../helpers/demo-app'

describe('demo removal (013 T002)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let ownDepot: string
  let worldId: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
    db = app.get<AppDatabase>(DB)
    // The owner's own depot holds the same ETF as the demo.
    const own = db.insert(institution).values({ name: 'Eigener Broker' }).returning().get()
    ownDepot = db
      .insert(account)
      .values({ institutionId: own.id, name: 'Eigenes Depot', type: 'depot' })
      .returning()
      .get().id
    worldId = db.select().from(instrument).where(eq(instrument.isin, 'IE00B4L5Y983')).get()!.id
    db.insert(transaction)
      .values({
        accountId: ownDepot,
        bookingDate: '2026-06-02',
        amountCents: -50_000,
        type: 'buy',
        source: 'manual',
        instrumentId: worldId,
        quantity: '5',
        unitPrice: '100',
        fingerprint: 'own-buy',
      })
      .run()
    db.insert(price)
      .values({ instrumentId: worldId, date: '2026-11-25', close: '110', source: 'scalable' })
      .onConflictDoNothing()
      .run()
  })
  afterAll(() => app.close())

  const call = (method: 'GET' | 'DELETE', url: string) =>
    app.inject({ method, url, headers: { cookie } })

  it('marks seeded institutions as demo', async () => {
    expect((await call('GET', '/api/demo')).json()).toEqual({ present: true })
    const demo = db.select().from(institution).where(eq(institution.isDemo, true)).all()
    expect(demo.map((row) => row.name).sort()).toEqual(['Demo Bank', 'Demo Broker'])
  })

  it('removes the demo and keeps the owner data', async () => {
    const res = await call('DELETE', '/api/demo')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ institutions: 2, accounts: 3 })

    const accounts = (await call('GET', '/api/accounts')).json() as AccountDto[]
    expect(accounts.map((acc) => acc.name)).toEqual(['Eigenes Depot'])
    expect(
      db
        .select()
        .from(transaction)
        .all()
        .map((tx) => tx.fingerprint),
    ).toEqual(['own-buy'])
    // Shared instrument stays, without the demo's manual prices.
    const prices = db.select().from(price).where(eq(price.instrumentId, worldId)).all()
    expect(prices.length).toBeGreaterThan(0)
    expect(prices.every((row) => row.source !== 'manual')).toBe(true)
    // Demo-only instruments and the demo watchlist are gone.
    expect(
      db.select().from(instrument).where(eq(instrument.isin, 'US0378331005')).get(),
    ).toBeUndefined()
    expect(
      db.select().from(watchlist).where(eq(watchlist.name, 'Beobachten')).get(),
    ).toBeUndefined()

    expect((await call('GET', '/api/demo')).json()).toEqual({ present: false })
    expect((await call('DELETE', '/api/demo')).statusCode).toBe(404)
  })

  it('sums show only the owner data afterwards', async () => {
    const allocation = (await call('GET', '/api/overview/allocation')).json() as {
      totalCents: number
    }
    const own = (await call('GET', `/api/overview/allocation?accounts=${ownDepot}`)).json() as {
      totalCents: number
    }
    expect(allocation.totalCents).toBe(own.totalCents)
  })
})
