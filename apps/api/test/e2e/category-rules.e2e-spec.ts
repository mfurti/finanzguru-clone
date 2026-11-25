import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CategorizeResult } from '@finance/shared'
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
describe('category change with scope and rules (006 US1)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let giro: string
  let strom: string
  let miete: string

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
    strom = add('Strom Test')
    miete = add('Miete Test')
  })

  afterAll(async () => {
    await app?.close()
  })

  let seq = 0
  /** Adds a booking; returns its id. */
  const booking = (values: Partial<typeof transaction.$inferInsert>) =>
    db
      .insert(transaction)
      .values({
        accountId: giro,
        bookingDate: '2026-11-01',
        amountCents: -5000,
        type: 'expense',
        source: 'manual',
        fingerprint: `fp-${++seq}`,
        ...values,
      })
      .returning()
      .get().id
  const row = (id: string) => db.select().from(transaction).where(eq(transaction.id, id)).get()!
  const patch = (id: string, payload: object) =>
    app.inject({ method: 'PATCH', url: `/api/transactions/${id}`, headers: { cookie }, payload })

  it('changes only this booking by default and creates no rule', async () => {
    const a = booking({ counterparty: 'Stadtwerke Musterstadt' })
    const b = booking({ counterparty: 'Stadtwerke Musterstadt' })
    const res = await patch(a, { categoryId: strom })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ updated: 1, ruleId: null, ruleApplied: 0, suggestion: null })
    expect(row(a)).toMatchObject({ categoryId: strom, categorySource: 'manual' })
    expect(row(b).categoryId).toBeNull()
    expect(db.select().from(categorizationRule).all()).toHaveLength(0)
  })

  it('applies to all bookings of the recipient, but never to manual or transfer ones', async () => {
    const first = booking({ counterparty: 'Vermieter GmbH' })
    const same = booking({ counterparty: '  VERMIETER   gmbh ' })
    const manual = booking({
      counterparty: 'Vermieter GmbH',
      categoryId: strom,
      categorySource: 'manual',
    })
    const transfer = booking({ counterparty: 'Vermieter GmbH', type: 'transfer' })
    const other = booking({ counterparty: 'Bäckerei' })
    const res = await patch(first, { categoryId: miete, scope: 'recipient' })
    expect((res.json() as CategorizeResult).updated).toBe(2)
    expect(row(same)).toMatchObject({
      categoryId: miete,
      categorySource: 'manual',
      reviewStatus: 'reviewed',
    })
    expect(row(manual).categoryId).toBe(strom)
    expect(row(transfer).categoryId).toBeNull()
    expect(row(other).categoryId).toBeNull()
  })

  it('remembers: saves a rule, applies it now and to later imports', async () => {
    const a = booking({ counterparty: 'Stromanbieter AG', amountCents: -7000 })
    const b = booking({ counterparty: 'Stromanbieter AG', amountCents: -6800 })
    const income = booking({ counterparty: 'Stromanbieter AG', amountCents: 2000, type: 'income' })
    const manual = booking({
      counterparty: 'Stromanbieter AG',
      categoryId: miete,
      categorySource: 'manual',
    })
    const res = await patch(a, {
      categoryId: strom,
      createRule: {
        matchField: 'counterparty',
        operator: 'contains',
        pattern: 'stromanbieter',
        amountSign: 'negative',
      },
    })
    const body = res.json() as CategorizeResult
    expect(body.ruleId).toEqual(expect.any(String))
    expect(body.ruleApplied).toBe(1)
    expect(row(b)).toMatchObject({ categoryId: strom, categorySource: 'rule' })
    expect(row(income).categoryId).toBeNull()
    expect(row(manual).categoryId).toBe(miete)
    const rule = db.select().from(categorizationRule).get()!
    expect(rule).toMatchObject({ amountSign: 'negative', enabled: true, categoryId: strom })
  })

  it('refuses recipient scope without counterparty and invalid patterns', async () => {
    const card = booking({ counterparty: null, purpose: 'KARTENZAHLUNG · Kiosk' })
    expect((await patch(card, { categoryId: strom, scope: 'recipient' })).statusCode).toBe(400)
    expect((await patch(card, { scope: 'recipient' })).statusCode).toBe(400)
    const bad = await patch(card, {
      categoryId: strom,
      createRule: { matchField: 'purpose', operator: 'regex', pattern: '(' },
    })
    expect(bad.statusCode).toBe(400)
    expect(row(card).categoryId).toBeNull()
  })
})
