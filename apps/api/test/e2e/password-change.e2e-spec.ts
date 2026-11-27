import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AuthService } from '../../src/modules/auth/auth.service'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** 014 T013: change the password; other sessions end, this one stays. */
describe('password change (014)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app?.close()
  })

  const change = (cookie: string, current: string, next: string) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { cookie },
      payload: { current, next },
    })
  const isLoggedIn = async (cookie: string) =>
    (await app.inject({ method: 'GET', url: '/api/auth/session', headers: { cookie } }))
      .statusCode === 200

  it('refuses a wrong current password and a short new one', async () => {
    const cookie = await loginCookie(app)
    const wrong = await change(cookie, 'falsch', 'ein-neues-langes-passwort')
    expect(wrong.statusCode).toBe(400)
    expect(wrong.json().statusMessage).toBe('Aktuelles Passwort ist falsch')
    expect((await change(cookie, 'test-owner-password', 'kurz')).statusCode).toBe(400)
  })

  it('changes it, ends other sessions and keeps this one', async () => {
    const other = await loginCookie(app)
    const mine = await loginCookie(app)
    const response = await change(mine, 'test-owner-password', 'ein-neues-langes-passwort')
    expect(response.statusCode).toBe(204)
    expect(await isLoggedIn(mine)).toBe(true)
    expect(await isLoggedIn(other)).toBe(false)
    const auth = app.get(AuthService)
    expect(await auth.verify('ein-neues-langes-passwort')).toBe(true)
    expect(await auth.verify('test-owner-password')).toBe(false)
  })
})
