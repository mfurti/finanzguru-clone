import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CategoryDetail, CategoryNode, CashflowCategories } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('category icons and detail (003 US3)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const tree = async () => (await call('GET', '/api/categories')).json() as CategoryNode[]

  it('ships default icons and validates icon keys', async () => {
    const wohnen = (await tree()).find((c) => c.name === 'Wohnen')!
    expect(wohnen.icon).toBe('house')
    expect(wohnen.children.find((c) => c.name === 'Strom')!.icon).toBe('zap')
    expect((await call('PATCH', `/api/categories/${wohnen.id}`, { icon: 'sofa' })).statusCode).toBe(
      200,
    )
    expect((await tree()).find((c) => c.id === wohnen.id)!.icon).toBe('sofa')
    // A rename keeps icon and color (no defaults applied on PATCH).
    await call('PATCH', `/api/categories/${wohnen.id}`, { name: 'Wohnen & Haus' })
    expect((await tree()).find((c) => c.id === wohnen.id)).toMatchObject({
      icon: 'sofa',
      color: wohnen.color,
    })
    expect(
      (await call('PATCH', `/api/categories/${wohnen.id}`, { icon: 'no-such-icon' })).statusCode,
    ).toBe(400)
    const created = await call('POST', '/api/categories', { name: 'Reisen', kind: 'expense' })
    expect(created.json()).toMatchObject({ icon: 'tag' })
  })

  it('returns the period total and a 12-month history incl. sub categories', async () => {
    const list = (
      await call('GET', '/api/cashflow/categories?anchor=2026-10-15&kind=expense')
    ).json() as CashflowCategories
    const top = list.items[0]!
    const res = await call('GET', `/api/cashflow/categories/${top.categoryId}?anchor=2026-10-15`)
    expect(res.statusCode).toBe(200)
    const detail = res.json() as CategoryDetail
    expect(detail.totalCents).toBe(top.totalCents)
    expect(detail.history).toHaveLength(12)
    expect(detail.history.at(-1)).toEqual({ month: '2026-10', cents: top.totalCents })
    expect(detail.history[0]!.month).toBe('2025-11')
    expect((await call('GET', '/api/cashflow/categories/missing')).statusCode).toBe(404)
  })
})
