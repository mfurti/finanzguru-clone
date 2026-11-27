import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DEFAULT_OWNER_SETTINGS, type OwnerSettings } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { userSetting } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('owner settings (014 T002)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'PATCH', payload?: object) =>
    app.inject({ method, url: '/api/settings', headers: { cookie }, payload })

  it('needs the owner session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/settings' })
    expect(response.statusCode).toBe(401)
  })

  it('returns the defaults on a fresh install', async () => {
    const response = await call('GET')
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(DEFAULT_OWNER_SETTINGS)
  })

  it('stores a partial update and returns the merged settings', async () => {
    const response = await call('PATCH', {
      density: 'compact',
      budgetMonthStart: 25,
      refreshSchedule: { mode: 'daily', time: '06:00', hours: 6 },
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<OwnerSettings>()
    expect(body.density).toBe('compact')
    expect(body.budgetMonthStart).toBe(25)
    expect(body.refreshSchedule.mode).toBe('daily')
    expect(body.startPage).toBe('dashboard')
    expect((await call('GET')).json<OwnerSettings>().density).toBe('compact')
  })

  it.each([
    [{ budgetMonthStart: 29 }],
    [{ autoLogoutMinutes: 20 }],
    [{ startPage: 'nowhere' }],
    [{ refreshSchedule: { mode: 'daily', time: '6 Uhr', hours: 6 } }],
    [{ somethingElse: true }],
  ])('rejects %o with 400', async (payload) => {
    expect((await call('PATCH', payload)).statusCode).toBe(400)
  })

  it('falls back to the default for an unreadable stored value', async () => {
    app
      .get<AppDatabase>(DB)
      .insert(userSetting)
      .values({ key: 'settings.rounding', value: '"tenths"' })
      .onConflictDoUpdate({ target: userSetting.key, set: { value: '"tenths"' } })
      .run()
    expect((await call('GET')).json<OwnerSettings>().rounding).toBe('cents')
  })
})
