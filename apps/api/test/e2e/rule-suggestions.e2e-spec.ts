import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CategorizeResult, RuleSuggestionDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  account,
  categorizationRule,
  category,
  institution,
  transaction,
} from '../../src/database/schema'
import { seedDefaults } from '../../src/database/seed'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** Invented recipients only (Constitution III). */
describe('rule suggestions from repeated corrections (006 US2)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let giro: string
  let handy: string
  let other: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    db = app.get<AppDatabase>(DB)
    seedDefaults(db)
    const inst = db.insert(institution).values({ name: 'Testbank' }).returning().get()
    giro = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Giro', type: 'checking' })
      .returning()
      .get().id
    const add = (name: string) =>
      db.insert(category).values({ name, kind: 'expense', color: 'neutral' }).returning().get().id
    handy = add('Handy Test')
    other = add('Sonstiges Test')
  })

  afterAll(async () => {
    await app?.close()
  })

  let seq = 0
  const booking = (counterparty: string) =>
    db
      .insert(transaction)
      .values({
        accountId: giro,
        bookingDate: '2026-11-01',
        amountCents: -2999,
        type: 'expense',
        source: 'manual',
        counterparty,
        fingerprint: `s-${++seq}`,
      })
      .returning()
      .get().id
  const categorize = async (id: string, categoryId: string, extra: object = {}) =>
    (
      await app.inject({
        method: 'PATCH',
        url: `/api/transactions/${id}`,
        headers: { cookie },
        payload: { categoryId, ...extra },
      })
    ).json() as CategorizeResult
  const call = (method: 'GET' | 'POST', url: string) =>
    app.inject({ method, url, headers: { cookie } })

  it('suggests a rule after the second identical manual categorization', async () => {
    const a = booking('Mobilfunk Test AG')
    const b = booking('MOBILFUNK TEST AG')
    booking('Mobilfunk Test AG')
    expect((await categorize(a, handy)).suggestion).toBeNull()
    const second = await categorize(b, handy)
    expect(second.suggestion).toMatchObject({
      counterparty: 'Mobilfunk Test AG',
      categoryId: handy,
      count: 2,
      affected: 1,
    })
    const list = (await call('GET', '/api/rules/suggestions')).json() as RuleSuggestionDto[]
    expect(list.map((item) => item.id)).toContain(second.suggestion!.id)
  })

  it('accepting saves the rule, applies it and ends the suggestion', async () => {
    const list = (await call('GET', '/api/rules/suggestions')).json() as RuleSuggestionDto[]
    const suggestion = list.find((item) => item.categoryId === handy)!
    const res = await call('POST', `/api/rules/suggestions/${suggestion.id}/accept`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ruleId: expect.any(String), applied: 1 })
    const rule = db
      .select()
      .from(categorizationRule)
      .where(eq(categorizationRule.id, (res.json() as { ruleId: string }).ruleId))
      .get()!
    expect(rule).toMatchObject({ matchField: 'counterparty', pattern: 'mobilfunk test ag' })
    expect((await call('GET', '/api/rules/suggestions')).json()).toEqual([])
    // Covered by the rule now: further corrections do not suggest again.
    const later = booking('Mobilfunk Test AG')
    expect((await categorize(later, handy)).suggestion).toBeNull()
  })

  it('declining hides the pair for good', async () => {
    const a = booking('Kiosk Test')
    const b = booking('Kiosk Test')
    const c = booking('Kiosk Test')
    await categorize(a, other)
    const due = (await categorize(b, other)).suggestion!
    expect((await call('POST', `/api/rules/suggestions/${due.id}/decline`)).statusCode).toBe(204)
    expect((await categorize(c, other)).suggestion).toBeNull()
    expect((await call('GET', '/api/rules/suggestions')).json()).toEqual([])
    expect((await call('POST', '/api/rules/suggestions/nope/decline')).statusCode).toBe(404)
  })

  it('saving a rule with "merken" marks the pair accepted', async () => {
    const a = booking('Bäcker Test')
    const b = booking('Bäcker Test')
    await categorize(a, other, {
      createRule: { matchField: 'counterparty', operator: 'contains', pattern: 'bäcker test' },
    })
    expect((await categorize(b, other)).suggestion).toBeNull()
  })
})
