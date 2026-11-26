import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TransactionPage } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, category, institution, transaction } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('built-in merchant rules on existing bookings (010 T011)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let accountId: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Regelbank' }).returning().get()
    accountId = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Regel-Giro', type: 'checking' })
      .returning()
      .get().id
    const travel = db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.name, 'Freizeitaktivitäten'))
      .get()!.id
    const rows = [
      { counterparty: 'PayPal (Europe) Regeltest', categoryId: null },
      { counterparty: 'Klarna Bank AB Regeltest', categoryId: null },
      // Already categorized by the import: stays.
      {
        counterparty: 'Amazon EU Regeltest',
        categoryId: travel,
        categorySource: 'import' as const,
      },
      { counterparty: 'Unbekannter Laden Regeltest', categoryId: null },
    ]
    rows.forEach((row, index) =>
      db
        .insert(transaction)
        .values({
          accountId,
          bookingDate: '2026-11-15',
          amountCents: -1500,
          type: 'expense',
          source: 'manual',
          fingerprint: `regel-${index}`,
          ...row,
        })
        .run(),
    )
  })
  afterAll(() => app.close())

  it('fills empty categories, keeps imported ones, leaves unknown merchants empty', async () => {
    const apply = await app.inject({ method: 'POST', url: '/api/rules/apply', headers: { cookie } })
    expect(apply.statusCode).toBe(200)
    const page = (await app
      .inject({ url: `/api/transactions?accounts=${accountId}`, headers: { cookie } })
      .then((res) => res.json())) as TransactionPage
    const by = (name: string) => page.items.find((item) => item.counterparty?.startsWith(name))!
    expect(by('PayPal').categoryName).toBe('Shopping und Unterhaltung')
    expect(by('Klarna').categoryName).toBe('Bank und Kredit')
    expect(by('Amazon').categoryName).toBe('Freizeitaktivitäten')
    expect(by('Unbekannter').categoryId).toBeNull()
  })
})
