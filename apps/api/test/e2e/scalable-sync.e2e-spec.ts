import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import type { DataSourceDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { dataSource } from '../../src/database/schema'
import type { TransportFactory } from '../../src/modules/sources/scalable-mcp/client'
import type { ScalableOAuthProvider } from '../../src/modules/sources/scalable-mcp/oauth-provider'
import { SCALABLE_TRANSPORT } from '../../src/modules/sources/scalable-mcp/scalable-connection.service'
import { loginCookie } from '../helpers/auth'
import { setTestEnv } from '../helpers/test-app'

/** What the fake Scalable side does on the next connection. */
let mode: 'connected' | 'login' = 'connected'

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
  const server = new McpServer({ name: 'fake-scalable', version: '1.0.0' })
  server.registerTool('get_portfolio', { description: 'Positions and cash balance' }, async () => ({
    content: [{ type: 'text', text: '{"positions":[]}' }],
  }))
  server.registerTool('place_order', { description: 'Buy or sell a security' }, async () => ({
    content: [{ type: 'text', text: 'ordered' }],
  }))
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
  })

  it('lists sources with last run and daily-sync flag but never credentials', async () => {
    const res = await call('GET', '/api/sources')
    const body = res.json() as DataSourceDto[]
    const scalable = body.find((source) => source.id === 'scalable_mcp')!
    expect(scalable).toMatchObject({ status: 'active', dailySync: false, lastRun: null })
    expect(res.body).not.toMatch(/encrypted|token|credential|clientInformation/i)
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
