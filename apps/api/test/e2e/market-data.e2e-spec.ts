import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import type { QuoteDto, SecuritySearchResponse, WatchlistDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { dataSource, instrument, price } from '../../src/database/schema'
import type { TransportFactory } from '../../src/modules/sources/scalable-mcp/client'
import { SCALABLE_TRANSPORT } from '../../src/modules/sources/scalable-mcp/scalable-mcp.source'
import { loginCookie } from '../helpers/auth'
import { setTestEnv } from '../helpers/test-app'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '../fixtures/scalable-mcp', `${name}.json`), 'utf8'))

/** Tool calls the fake Scalable side received. */
const called: string[] = []

/** In-memory MCP server serving the recorded market responses (005 T024). */
const fakeTransport: TransportFactory = () => {
  const server = new McpServer({ name: 'fake-scalable', version: '1.0.0' })
  const reply = (name: string) => async () => {
    called.push(name)
    return { content: [{ type: 'text' as const, text: JSON.stringify(fixture(name)) }] }
  }
  server.registerTool(
    'search_securities',
    {
      description: 'Search securities',
      inputSchema: { query: z.string() },
      annotations: { readOnlyHint: true },
    },
    reply('search_securities'),
  )
  server.registerTool(
    'get_security_quote',
    {
      description: 'Latest quote snapshot',
      inputSchema: { isin: z.string() },
      annotations: { readOnlyHint: true },
    },
    reply('get_security_quote'),
  )
  server.registerTool(
    'get_security_chart',
    {
      description: 'Chart points for one ISIN',
      inputSchema: { isin: z.string(), timeframe: z.string() },
      annotations: { readOnlyHint: true },
    },
    reply('get_security_chart'),
  )
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  void server.connect(serverSide)
  return clientSide
}

describe('market data through the Scalable connection (005 US4)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase

  beforeAll(async () => {
    setTestEnv()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SCALABLE_TRANSPORT)
      .useValue(fakeTransport)
      .compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await configureApp(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    cookie = await loginCookie(app)
    db = app.get<AppDatabase>(DB)
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const connect = (status: 'active' | 'disabled') =>
    db
      .insert(dataSource)
      .values({ id: 'scalable_mcp', kind: 'scalable_mcp', status, displayName: 'Scalable' })
      .onConflictDoUpdate({ target: dataSource.id, set: { status } })
      .run()

  it('reports search as unavailable without a Scalable connection', async () => {
    connect('disabled')
    const res = await call('GET', '/api/market-data/search?q=Apple')
    expect(res.json()).toEqual({ available: false, groups: [] })
    expect((await call('POST', '/api/market-data/refresh')).statusCode).toBe(409)
    expect(called).toEqual([])
  })

  it('groups hits by class and filters by class', async () => {
    connect('active')
    expect((await call('GET', '/api/market-data/search?q=A')).statusCode).toBe(400)
    const all = (
      await call('GET', '/api/market-data/search?q=Apple')
    ).json() as SecuritySearchResponse
    expect(all.available).toBe(true)
    expect(all.groups.map((group) => group.assetClass)).toEqual(['stock', 'etf'])
    const apple = all.groups[0]!.hits.find((hit) => hit.isin === 'US0378331005')
    expect(apple).toEqual({ isin: 'US0378331005', wkn: null, name: 'Apple', assetClass: 'stock' })
    const etf = (
      await call('GET', '/api/market-data/search?q=Apple&class=etf')
    ).json() as SecuritySearchResponse
    expect(etf.groups.map((group) => group.assetClass)).toEqual(['etf'])
  })

  let watchlistId = ''
  let appleId = ''

  it('adds a hit to a watchlist with its class; adding twice is refused', async () => {
    watchlistId = (
      (await call('POST', '/api/watchlists', { name: 'Tech' })).json() as { id: string }
    ).id
    const body = { isin: 'US0378331005', name: 'Apple', assetClass: 'stock' }
    const res = await call('POST', `/api/watchlists/${watchlistId}/entries`, body)
    expect(res.statusCode).toBe(201)
    appleId = (res.json() as WatchlistDto).entries[0]!.instrumentId
    const row = db.select().from(instrument).where(eq(instrument.id, appleId)).get()!
    expect(row).toMatchObject({ assetClass: 'stock', fundType: null })
    expect((await call('POST', `/api/watchlists/${watchlistId}/entries`, body)).statusCode).toBe(
      409,
    )
  })

  it('refreshes quotes for watched securities and stores today’s price', async () => {
    const res = await call('POST', '/api/market-data/refresh')
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ stored: 1 })
    const quotes = (
      await call('GET', `/api/market-data/quotes?ids=${appleId}`)
    ).json() as QuoteDto[]
    expect(quotes).toEqual([
      {
        instrumentId: appleId,
        price: '321.075',
        changeAbs: '-1.725',
        changePct: '-0.0053',
        quotedAt: '2026-11-25T11:12:26.925Z',
      },
    ])
    const stored = db.select().from(price).where(eq(price.instrumentId, appleId)).all()
    expect(stored).toContainEqual({
      instrumentId: appleId,
      date: '2026-11-25',
      close: '321.075',
      source: 'scalable',
    })
    const list = (await call('GET', `/api/watchlists/${watchlistId}`)).json() as WatchlistDto
    expect(list.entries[0]!.priceCents).toBe(32108)
    expect(list.entries[0]!.quotedAt).toBe('2026-11-25T11:12:26.925Z')
    expect(list.entries[0]!.sparkline!.length).toBeGreaterThanOrEqual(2)
  })

  it('returns one close per day for the chart and keeps them as prices', async () => {
    const res = await call('GET', `/api/market-data/chart/${appleId}?range=1M`)
    expect(res.statusCode).toBe(200)
    const points = res.json() as { date: string; close: string }[]
    expect(points.length).toBeGreaterThan(15)
    expect(new Set(points.map((point) => point.date)).size).toBe(points.length)
    expect(points.every((point) => /^\d+(?:\.\d+)?$/.test(point.close))).toBe(true)
    expect((await call('GET', `/api/market-data/chart/${appleId}?range=5Y`)).statusCode).toBe(400)
    expect((await call('GET', '/api/market-data/chart/nope?range=1M')).statusCode).toBe(404)
  })

  it('only ever called the three read tools', () => {
    expect([...new Set(called)].sort()).toEqual([
      'get_security_chart',
      'get_security_quote',
      'search_securities',
    ])
  })
})
