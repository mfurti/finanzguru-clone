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
})
