import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CategorizationRuleDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { category } from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('rules management (006 US3)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let categoryId: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    seedDefaults(db)
    categoryId = db.select().from(category).get()!.id
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const create = async (pattern: string) =>
    (
      await call('POST', '/api/rules', {
        matchField: 'counterparty',
        operator: 'contains',
        pattern,
        categoryId,
      })
    ).json() as CategorizationRuleDto

  it('appends new rules at the end of the order', async () => {
    const a = await create('alpha')
    const b = await create('beta')
    expect(b.priority).toBe(a.priority + 1)
  })

  it('reorders all rules and keeps priorities unique and ascending', async () => {
    const c = await create('gamma')
    const before = (await call('GET', '/api/rules')).json() as CategorizationRuleDto[]
    const ids = before.map((rule) => rule.id)
    const moved = [c.id, ...ids.filter((id) => id !== c.id)]
    const res = await call('POST', '/api/rules/reorder', { ids: moved })
    expect(res.statusCode).toBe(200)
    const after = res.json() as CategorizationRuleDto[]
    expect(after.map((rule) => rule.id)).toEqual(moved)
    expect(after.map((rule) => rule.priority)).toEqual(moved.map((_, index) => index + 1))
  })

  it('refuses an order that misses or repeats a rule', async () => {
    const rules = (await call('GET', '/api/rules')).json() as CategorizationRuleDto[]
    const ids = rules.map((rule) => rule.id)
    expect((await call('POST', '/api/rules/reorder', { ids: ids.slice(1) })).statusCode).toBe(400)
    expect(
      (await call('POST', '/api/rules/reorder', { ids: [...ids.slice(1), ids[1]!] })).statusCode,
    ).toBe(400)
  })

  it('switches a rule off and on', async () => {
    const rule = await create('delta')
    const off = await call('PATCH', `/api/rules/${rule.id}`, { enabled: false })
    expect((off.json() as CategorizationRuleDto).enabled).toBe(false)
    const on = await call('PATCH', `/api/rules/${rule.id}`, { enabled: true })
    expect((on.json() as CategorizationRuleDto).enabled).toBe(true)
  })
})
