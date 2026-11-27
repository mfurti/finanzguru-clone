import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { dataSource } from '../../src/database/schema'
import { MarketDataService } from '../../src/modules/market-data/market-data.service'
import { SyncService } from '../../src/modules/sources/sync.service'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** 013 T007: refresh every connected source and report the data state. */
describe('refresh all sources', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    db = app.get<AppDatabase>(DB)
    db.insert(dataSource)
      .values([
        {
          id: 'enable_banking',
          kind: 'enable_banking',
          status: 'active',
          displayName: 'Sparkasse',
        },
        { id: 'scalable_mcp', kind: 'scalable_mcp', status: 'active', displayName: 'Scalable' },
      ])
      .run()
    const sync = app.get(SyncService)
    vi.spyOn(sync, 'canSync').mockReturnValue(true)
    vi.spyOn(sync, 'run').mockImplementation(async (id: string) => {
      if (id === 'scalable_mcp') throw new Error('Anmeldung bei Scalable abgelaufen')
      db.update(dataSource).set({ lastSyncAt: new Date().toISOString() }).run()
      return { runId: 'r1', status: 'succeeded', imported: 2, skipped: 0, error: null }
    })
    const market = app.get(MarketDataService)
    vi.spyOn(market, 'available').mockReturnValue(true)
    vi.spyOn(market, 'refresh').mockResolvedValue(3)
  })
  afterAll(() => app.close())

  const call = (method: 'GET' | 'POST', url: string) =>
    app.inject({ method, url, headers: { cookie } })

  it('starts outdated when a connected source was never fetched', async () => {
    const state = (await call('GET', '/api/sources/state')).json()
    expect(state).toMatchObject({ oldestSuccessAt: null, outdated: true })
    expect(state.sources.map((row: { source: string }) => row.source)).toEqual([
      'enable_banking',
      'scalable_mcp',
      'quotes',
    ])
  })

  it('fetches every source and reports each result, a failure does not stop the rest', async () => {
    const res = await call('POST', '/api/sources/refresh-all')
    expect(res.statusCode).toBe(201)
    expect(
      res
        .json()
        .map((row: { source: string; ok: boolean; error: string | null }) => [
          row.source,
          row.ok,
          row.error,
        ]),
    ).toEqual([
      ['enable_banking', true, null],
      ['scalable_mcp', false, 'Anmeldung bei Scalable abgelaufen'],
      ['quotes', true, null],
    ])
  })
})
