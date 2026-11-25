import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TransactionPage } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, transaction } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('logos in the booking list (008 T007)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let accountId: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Logobank' }).returning().get()
    accountId = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Logo-Giro', type: 'checking' })
      .returning()
      .get().id
    const rows = [
      { counterparty: 'REWE Markt GmbH', type: 'expense' as const, amountCents: -2599 },
      {
        counterparty: 'PayPal (Europe) S.a.r.l. et Cie',
        type: 'expense' as const,
        amountCents: -999,
      },
      { counterparty: 'Bäckerei Logotest', type: 'expense' as const, amountCents: -350 },
      {
        counterparty: 'PayPal (Europe) S.a.r.l. et Cie',
        type: 'transfer' as const,
        amountCents: -5000,
      },
      {
        counterparty: null,
        purpose: 'KARTENZAHLUNG · LIDL SAGT DANKE',
        type: 'expense' as const,
        amountCents: -1200,
      },
    ]
    rows.forEach((row, index) =>
      db
        .insert(transaction)
        .values({
          accountId,
          bookingDate: `2026-11-1${index}`,
          source: 'manual',
          fingerprint: `logo-${index}`,
          ...row,
        })
        .run(),
    )
  })
  afterAll(() => app.close())

  it('adds automatic brand logos, initials (null) and no logo for transfers', async () => {
    const page = (await app
      .inject({ url: `/api/transactions?accounts=${accountId}&pageSize=50`, headers: { cookie } })
      .then((res) => res.json())) as TransactionPage
    const by = (name: string | null, type = 'expense') =>
      page.items.find((item) => item.counterparty === name && item.type === type)!
    expect(by('REWE Markt GmbH')).toMatchObject({
      logo: { kind: 'brand', slug: 'rewe', title: 'REWE' },
      logoSource: 'auto',
      recipientKey: 'rewe markt gmbh',
    })
    expect(by('REWE Markt GmbH').logo).toMatchObject({
      url: expect.stringMatching(/rewe\.svg\?v=/),
    })
    expect(by('PayPal (Europe) S.a.r.l. et Cie').logo).toMatchObject({ slug: 'paypal' })
    expect(by('Bäckerei Logotest')).toMatchObject({ logo: null, logoSource: null })
    expect(by('PayPal (Europe) S.a.r.l. et Cie', 'transfer')).toMatchObject({ logo: null })
    expect(by(null)).toMatchObject({
      logo: { kind: 'brand', slug: 'lidl' },
      recipientKey: 'purpose:lidl sagt danke',
    })
  })
})
