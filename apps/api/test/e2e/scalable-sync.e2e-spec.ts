import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import type { DataSourceDto } from '@finance/shared'
import { desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, dataSource, importJob, transaction } from '../../src/database/schema'
import { SyncService } from '../../src/modules/sources/sync.service'
import type { TransportFactory } from '../../src/modules/sources/scalable-mcp/client'
import type { ScalableOAuthProvider } from '../../src/modules/sources/scalable-mcp/oauth-provider'
import { SCALABLE_TRANSPORT } from '../../src/modules/sources/scalable-mcp/scalable-connection.service'
import { loginCookie } from '../helpers/auth'
import { setTestEnv } from '../helpers/test-app'

/** What the fake Scalable side does on the next connection. */
let mode: 'connected' | 'login' = 'connected'
/** Calls of the order tool; must stay 0. */
let orders = 0
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '../fixtures/scalable-mcp', `${name}.json`), 'utf8'))

/** In-memory MCP server standing in for Scalable (read tool + order tool). */
const fakeTransport: TransportFactory = (_url, provider: ScalableOAuthProvider) => {
  if (mode === 'login') {
    const failing: Transport = {
      start: async () => {
        provider.pendingAuthorizationUrl = new URL('https://login.scalable.example/authorize?x=1')
        throw new Error('401')
      },
      send: async () => undefined,
      close: async () => undefined,
    }
    return failing
  }
  // Serves the anonymized real responses (004 T006) for the allowlisted read tools.
  const server = new McpServer({ name: 'fake-scalable', version: '1.0.0' })
  const reply = (name: string) => async () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(fixture(name)) }],
  })
  const portfolioArg = { portfolioId: z.string().optional() }
  server.registerTool(
    'list_accessible_portfolios',
    { description: 'Broker portfolios', annotations: { readOnlyHint: true } },
    reply('list_accessible_portfolios'),
  )
  server.registerTool(
    'get_portfolio_holdings',
    { description: 'Holdings', inputSchema: portfolioArg, annotations: { readOnlyHint: true } },
    reply('get_portfolio_holdings'),
  )
  server.registerTool(
    'get_portfolio_cash_breakdown',
    {
      description: 'Cash and buying-power breakdown',
      inputSchema: portfolioArg,
      annotations: { readOnlyHint: true },
    },
    reply('get_portfolio_cash_breakdown'),
  )
  server.registerTool(
    'list_portfolio_transactions',
    {
      description: 'Broker transactions with pagination',
      inputSchema: {
        ...portfolioArg,
        pageSize: z.number().optional(),
        cursor: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ cursor }) => ({
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            fixture(
              cursor === 'cursor-page-2'
                ? 'list_portfolio_transactions.page2'
                : 'list_portfolio_transactions.page1',
            ),
          ),
        },
      ],
    }),
  )
  server.registerTool('place_order', { description: 'Buy or sell a security' }, async () => {
    orders++
    return { content: [{ type: 'text', text: 'ordered' }] }
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  void server.connect(serverSide)
  return clientSide
}

describe('Scalable connection and source endpoints (004 US1)', () => {
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

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string) =>
    app.inject({ method, url, headers: { cookie } })

  it('returns Scalable’s login page when no grant is stored', async () => {
    mode = 'login'
    const res = await call('POST', '/api/sources/scalable/connect')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      connected: false,
      authorizationUrl: 'https://login.scalable.example/authorize?x=1',
    })
  })

  it('activates the source and stores the tool manifest when the grant works', async () => {
    mode = 'connected'
    const res = await call('POST', '/api/sources/scalable/connect')
    expect(res.json()).toEqual({ connected: true, authorizationUrl: null })
    const row = db.select().from(dataSource).where(eq(dataSource.id, 'scalable_mcp')).get()!
    expect(row.status).toBe('active')
    const manifest = row.toolManifest as { tools: { name: string; allowed: boolean }[] }
    expect(manifest.tools.find((tool) => tool.name === 'place_order')!.allowed).toBe(false)
    expect(
      manifest.tools.find((tool) => tool.name === 'get_portfolio_cash_breakdown')!.allowed,
    ).toBe(true)
  })

  it('lists sources with last run and daily-sync flag but never credentials', async () => {
    const res = await call('GET', '/api/sources')
    const body = res.json() as DataSourceDto[]
    const scalable = body.find((source) => source.id === 'scalable_mcp')!
    expect(scalable).toMatchObject({ status: 'active', dailySync: false, lastRun: null })
    expect(res.body).not.toMatch(/encrypted|token|credential|clientInformation/i)
  })

  it('syncs the recorded portfolio: depot, reference account, bookings, no duplicates (004 T007)', async () => {
    const res = await call('POST', '/api/sources/scalable_mcp/sync')
    expect(res.statusCode).toBe(202)
    const sync = app.get(SyncService)
    await vi.waitFor(() => expect(sync.isRunning('scalable_mcp')).toBe(false), { timeout: 10_000 })
    const run = sync.lastRun('scalable_mcp')!
    const source = db.select().from(dataSource).where(eq(dataSource.id, 'scalable_mcp')).get()!
    expect(source.lastError).toBeNull()
    expect(run.imported).toBeGreaterThan(100)
    // Full recorded history: positions from the bookings match Scalable's holdings.
    expect(run.status).toBe('succeeded')
    const accounts = db.select().from(account).where(eq(account.sourceId, 'scalable_mcp')).all()
    expect(accounts.map((a) => a.type).sort()).toEqual(['depot', 'reference'])
    const cash = fixture('get_portfolio_cash_breakdown') as { cash: { cashBalance: number } }
    expect(accounts.find((a) => a.type === 'reference')!.balanceCents).toBe(
      Math.round(cash.cash.cashBalance * 100),
    )
    const before = db.select().from(transaction).all().length
    const again = await sync.run('scalable_mcp')
    expect(again.imported).toBe(0)
    expect(db.select().from(transaction).all()).toHaveLength(before)
    expect(orders).toBe(0)
    const job = db.select().from(importJob).orderBy(desc(importJob.startedAt)).get()!
    expect(JSON.stringify(job.errors)).not.toContain('positions_mismatch')
    const holding = (
      fixture('get_portfolio_holdings') as {
        holdings: { isin: string; position: { filled: number } }[]
      }
    ).holdings[0]!
    const res2 = await call('GET', '/api/investments/positions')
    const position = (res2.json() as { isin: string; quantity: string }[]).find(
      (row) => row.isin === holding.isin,
    )!
    // 5 places: the anonymized fixtures scale each quantity separately (rounding).
    expect(Number(position.quantity)).toBeCloseTo(holding.position.filled, 5)
  })

  it('rejects a callback with a wrong state and redirects back with an error', async () => {
    const res = await call('GET', '/api/sources/scalable/callback?code=abc&state=forged')
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/settings/sources?error=scalable')
  })

  it('explains a refusal from Scalable (Agentic Investing not enabled)', async () => {
    const description = encodeURIComponent(
      'To connect Scalable MCP, enable Agentic Investing in your Scalable Capital security settings on the web, then try again.',
    )
    const res = await call(
      'GET',
      `/api/sources/scalable/callback?error=access_denied&error_description=${description}&state=x`,
    )
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('/settings/sources?error=scalable&reason=agentic')
    const other = await call('GET', '/api/sources/scalable/callback?error=access_denied&state=x')
    expect(other.headers.location).toBe('/settings/sources?error=scalable&reason=denied')
  })

  it('refuses a sync for CSV sources and unknown ids', async () => {
    expect((await call('POST', '/api/sources/csv/sync')).statusCode).toBe(409)
    expect((await call('POST', '/api/sources/missing/sync')).statusCode).toBe(404)
  })

  it('disconnects: grant deleted, status disabled, data kept', async () => {
    const res = await call('DELETE', '/api/sources/scalable_mcp')
    expect(res.statusCode).toBe(204)
    const row = db.select().from(dataSource).where(eq(dataSource.id, 'scalable_mcp')).get()!
    expect(row).toMatchObject({ status: 'disabled', encryptedCredentials: null })
    expect((await call('DELETE', '/api/sources/csv')).statusCode).toBe(404)
  })
})
