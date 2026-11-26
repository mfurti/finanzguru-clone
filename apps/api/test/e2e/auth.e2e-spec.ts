import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthService } from '../../src/modules/auth/auth.service'
import { createTestApp } from '../helpers/test-app'

const PASSWORD = 'richtig-langes-passwort'

function sessionCookie(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie
  if (!header) throw new Error('no set-cookie header')
  return header.split(';')[0] ?? ''
}

describe('auth', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createTestApp()
    await app.get(AuthService).setOwner('Alex', PASSWORD)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('rejects protected routes without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/session' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ statusCode: 401, statusMessage: 'Nicht angemeldet' })
  })

  it('keeps public routes open', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'falsch' },
    })
    expect(res.statusCode).toBe(401)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('logs in, reads the session and logs out', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: PASSWORD },
    })
    expect(login.statusCode).toBe(204)
    const setCookie = String(login.headers['set-cookie'])
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    const cookie = sessionCookie(login.headers['set-cookie'])

    const session = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie },
    })
    expect(session.statusCode).toBe(200)
    expect(session.json()).toEqual({ displayName: 'Alex' })

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie },
    })
    expect(logout.statusCode).toBe(204)
    const cleared = sessionCookie(logout.headers['set-cookie'])
    const after = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: cleared },
    })
    expect(after.statusCode).toBe(401)
  })

  it('rejects a forged cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: 'session=forged%3Bvalue' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('throttles login attempts to 5 per minute', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { password: 'falsch' },
        remoteAddress: '10.0.0.99',
      })
      statuses.push(res.statusCode)
    }
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })
})
