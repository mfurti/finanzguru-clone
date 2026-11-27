import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { WatchlistDto, WatchlistSummary } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addDays, todayIso } from '../../src/domain/period'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('Watchlists (US6)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('creates, renames and deletes lists with unique names', async () => {
    const a = (await call('POST', '/api/watchlists', { name: 'Ideen' })).json() as WatchlistSummary
    expect(a).toMatchObject({ name: 'Ideen', count: 0 })
    expect((await call('POST', '/api/watchlists', { name: 'Ideen' })).statusCode).toBe(409)
    expect((await call('POST', '/api/watchlists', { name: '' })).statusCode).toBe(400)
    const b = (await call('POST', '/api/watchlists', { name: 'Dividenden' })).json()
    expect((await call('PATCH', `/api/watchlists/${a.id}`, { name: 'Wachstum' })).json().name).toBe(
      'Wachstum',
    )
    expect((await call('DELETE', `/api/watchlists/${b.id}`)).statusCode).toBe(204)
    expect(
      ((await call('GET', '/api/watchlists')).json() as WatchlistSummary[]).map((w) => w.name),
    ).toEqual(['Wachstum'])
  })

  it('adds securities by ISIN and shows price changes (W13)', async () => {
    const list = (
      await call('POST', '/api/watchlists', { name: 'Test' })
    ).json() as WatchlistSummary
    expect(
      (
        await call('POST', `/api/watchlists/${list.id}/entries`, {
          isin: 'IE00B5BMR088',
          name: 'X',
        })
      ).statusCode,
    ).toBe(400)
    const added = await call('POST', `/api/watchlists/${list.id}/entries`, {
      isin: 'IE00B5BMR087',
      name: 'S&P 500 ETF',
    })
    expect(added.statusCode).toBe(201)
    const entry = (added.json() as WatchlistDto).entries[0]!
    expect(entry).toMatchObject({ isin: 'IE00B5BMR087', hasPrices: false, priceCents: null })
    expect(
      (
        await call('POST', `/api/watchlists/${list.id}/entries`, {
          isin: 'IE00B5BMR087',
          name: 'again',
        })
      ).statusCode,
    ).toBe(409)

    const today = todayIso()
    await call('POST', `/api/instruments/${entry.instrumentId}/prices`, {
      prices: [
        { date: addDays(today, -400), close: '400' },
        { date: addDays(today, -8), close: '480' },
        { date: today, close: '500' },
      ],
    })
    const year = (await call('GET', `/api/watchlists/${list.id}?period=1Y`)).json() as WatchlistDto
    expect(year.entries[0]).toMatchObject({
      priceCents: 50_000,
      priceDate: today,
      changeCents: 10_000,
      changePct: '0.25',
      stale: false,
      hasPrices: true,
    })
    const week = (await call('GET', `/api/watchlists/${list.id}?period=1W`)).json() as WatchlistDto
    expect(week.entries[0]).toMatchObject({ changeCents: 2_000 })

    expect(
      (await call('DELETE', `/api/watchlists/${list.id}/entries/${entry.instrumentId}`)).statusCode,
    ).toBe(204)
    expect(
      (await call('DELETE', `/api/watchlists/${list.id}/entries/${entry.instrumentId}`)).statusCode,
    ).toBe(404)
  })
})

describe('Watchlist default (012 T014)', () => {
  it('creates a first "Watchlist" when the owner has none', async () => {
    const app = await createTestApp()
    const cookie = await loginCookie(app)
    const res = await app.inject({ method: 'GET', url: '/api/watchlists', headers: { cookie } })
    expect((res.json() as WatchlistSummary[]).map((w) => w.name)).toEqual(['Watchlist'])
    const again = await app.inject({ method: 'GET', url: '/api/watchlists', headers: { cookie } })
    expect(again.json()).toHaveLength(1)
    await app.close()
  })
})
