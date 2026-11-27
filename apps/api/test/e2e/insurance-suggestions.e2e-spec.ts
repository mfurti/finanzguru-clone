import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { InsuranceSuggestionDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, category, institution, transaction } from '../../src/database/schema'
import { addMonths, todayIso } from '../../src/domain/period'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('insurance suggestions (012 T016)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Testbank' }).returning().get()
    const giro = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Giro', type: 'checking' })
      .returning()
      .get()
    const life = db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.name, 'Risiko-Lebensversicherung'))
      .get()!.id
    const today = todayIso()
    for (const [i, months] of [-3, -2, -1].entries()) {
      db.insert(transaction)
        .values({
          accountId: giro.id,
          bookingDate: addMonths(today, months),
          amountCents: -2362,
          type: 'expense',
          source: 'manual',
          counterparty: 'Muster Lebensversicherung AG',
          categoryId: life,
          fingerprint: `ins-${i}`,
        })
        .run()
    }
  })
  afterAll(() => app.close())

  const get = async () =>
    (
      await app.inject({ url: '/api/insurance/suggestions', headers: { cookie } })
    ).json() as InsuranceSuggestionDto[]

  it('suggests the recurring contract and hides it once dismissed', async () => {
    const [suggestion] = await get()
    expect(suggestion).toMatchObject({
      counterparty: 'Muster Lebensversicherung AG',
      amountCents: 2362,
      interval: 'monthly',
      type: 'term_life',
      count: 3,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/insurance/suggestions/${encodeURIComponent(suggestion!.key)}/dismiss`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await get()).toEqual([])
  })
})
