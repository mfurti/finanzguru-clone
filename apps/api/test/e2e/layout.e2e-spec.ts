import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { WIDGET_KEYS } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('dashboard layout', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  it('returns the seeded default order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/layout',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().map((item: { widgetKey: string }) => item.widgetKey)).toEqual([
      ...WIDGET_KEYS,
    ])
  })

  it('stores a new order and visibility', async () => {
    const reordered = [...WIDGET_KEYS].reverse().map((widgetKey, position) => ({
      widgetKey,
      position,
      visible: widgetKey !== 'budgets',
    }))
    const put = await app.inject({
      method: 'PUT',
      url: '/api/dashboard/layout',
      headers: { cookie },
      payload: reordered,
    })
    expect(put.statusCode).toBe(200)
    const items = put.json() as { widgetKey: string; visible: boolean }[]
    expect(items[0]?.widgetKey).toBe('budgets')
    expect(items[0]?.visible).toBe(false)
  })

  it('rejects incomplete or duplicate layouts', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/dashboard/layout',
      headers: { cookie },
      payload: WIDGET_KEYS.map((_, position) => ({ widgetKey: 'kpis', position, visible: true })),
    })
    expect(res.statusCode).toBe(400)
  })

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/layout' })
    expect(res.statusCode).toBe(401)
  })
})
