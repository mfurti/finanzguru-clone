import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { OwnerSessionDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { ownerSession } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** 014 T012: one row per login, "Überall abmelden", idle logout. */
describe('owner sessions (014)', () => {
  let app: NestFastifyApplication
  // Login is rate-limited (5 per minute): the idle test reuses this session.
  let kept: string

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (
    method: 'GET' | 'DELETE' | 'PATCH' | 'POST',
    url: string,
    cookie: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie, 'user-agent': 'Vitest Browser' }, payload })
  const isLoggedIn = async (cookie: string) =>
    (await call('GET', '/api/auth/session', cookie)).statusCode === 200

  it('lists every login and marks the current one', async () => {
    const first = await loginCookie(app)
    const second = await loginCookie(app)
    const list = (await call('GET', '/api/auth/sessions', second)).json<OwnerSessionDto[]>()
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.filter((s) => s.current)).toHaveLength(1)
    expect(await isLoggedIn(first)).toBe(true)
  })

  it('"Überall abmelden" ends every other session', async () => {
    const other = await loginCookie(app)
    const mine = await loginCookie(app)
    kept = mine
    expect((await call('DELETE', '/api/auth/sessions', mine)).statusCode).toBe(204)
    expect(await isLoggedIn(other)).toBe(false)
    expect(await isLoggedIn(mine)).toBe(true)
    const list = (await call('GET', '/api/auth/sessions', mine)).json<OwnerSessionDto[]>()
    expect(list).toHaveLength(1)
    expect(list[0]!.current).toBe(true)
  })

  it('logout ends the session row', async () => {
    const cookie = await loginCookie(app)
    const before = app.get<AppDatabase>(DB).select().from(ownerSession).all().length
    await call('POST', '/api/auth/logout', cookie)
    expect(app.get<AppDatabase>(DB).select().from(ownerSession).all().length).toBe(before - 1)
    expect(await isLoggedIn(cookie)).toBe(false)
  })

  it('ends a session after the idle time; never without the setting', async () => {
    const cookie = kept
    const db = app.get<AppDatabase>(DB)
    const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString()
    db.update(ownerSession).set({ lastSeenAt: hourAgo }).run()
    expect(await isLoggedIn(cookie)).toBe(true)

    await call('PATCH', '/api/settings', cookie, { autoLogoutMinutes: 15 })
    db.update(ownerSession).set({ lastSeenAt: hourAgo }).run()
    expect(await isLoggedIn(cookie)).toBe(false)
  })
})
