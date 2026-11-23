import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { dataSource } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { multipartBody } from '../helpers/multipart'
import { createTestApp } from '../helpers/test-app'

describe('security hardening (T076)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('sends helmet security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(res.headers['strict-transport-security']).toBeDefined()
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('never returns stored credentials', async () => {
    const db = app.get<AppDatabase>(DB)
    db.insert(dataSource)
      .values({
        kind: 'scalable_mcp',
        displayName: 'Scalable Test',
        status: 'active',
        encryptedCredentials: Buffer.from('secret-token-bytes'),
      })
      .run()
    const res = await app.inject({ method: 'GET', url: '/api/sources', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toMatch(/credential|secret-token|token/i)
  })

  it('never returns the password hash', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } })
    expect(res.body).not.toMatch(/hash|scrypt|password/i)
  })

  it('rejects uploads over 20 MB', async () => {
    const { payload, headers } = await multipartBody(Buffer.alloc(21 * 1024 * 1024, 65), 'big.csv')
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/csv',
      headers: { ...headers, cookie },
      payload,
    })
    expect(res.statusCode).toBe(400)
  })

  it('requires a session for every feature 002 endpoint', async () => {
    const routes: [string, string][] = [
      ['GET', '/api/analysis/breakdown'],
      ['GET', '/api/analysis/returns'],
      ['GET', '/api/analysis/compare'],
      ['GET', '/api/groupings'],
      ['POST', '/api/groupings'],
      ['GET', '/api/settings/inflation'],
      ['PUT', '/api/settings/inflation'],
      ['GET', '/api/instruments'],
      ['POST', '/api/instruments'],
      ['POST', '/api/instruments/x/prices'],
      ['GET', '/api/instruments/x/classification'],
      ['PUT', '/api/instruments/x/classification'],
      ['GET', '/api/dividends/summary'],
      ['GET', '/api/dividends/calendar'],
      ['POST', '/api/dividends/expected'],
      ['GET', '/api/taxes/2026'],
      ['PUT', '/api/taxes/2026'],
      ['POST', '/api/taxes/2026/orders'],
      ['GET', '/api/taxes/2026/vorabpauschale'],
      ['GET', '/api/benchmarks'],
      ['GET', '/api/benchmarks/x/series'],
      ['GET', '/api/settings/charts'],
      ['PUT', '/api/settings/charts'],
      ['GET', '/api/watchlists'],
      ['POST', '/api/watchlists'],
      ['POST', '/api/watchlists/x/entries'],
      ['GET', '/api/investments/transactions.csv'],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({
        method: method as 'GET',
        url,
        payload: method === 'GET' ? undefined : {},
      })
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
  })
})
