import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TransactionPage } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, transaction } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('logo choice per recipient (008 T010)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let accountId: string
  const key = encodeURIComponent('lidl dienstleistung test')

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Wahlbank' }).returning().get()
    accountId = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Wahl-Giro', type: 'checking' })
      .returning()
      .get().id
    for (const [index, counterparty] of [
      'LIDL DIENSTLEISTUNG TEST',
      'Lidl  Dienstleistung Test',
      'REWE Wahltest',
    ].entries()) {
      db.insert(transaction)
        .values({
          accountId,
          bookingDate: `2026-11-0${index + 1}`,
          amountCents: -500,
          type: 'expense',
          source: 'manual',
          counterparty,
          fingerprint: `wahl-${index}`,
        })
        .run()
    }
  })
  afterAll(() => app.close())

  const list = async () =>
    (
      (await app
        .inject({ url: `/api/transactions?accounts=${accountId}`, headers: { cookie } })
        .then((res) => res.json())) as TransactionPage
    ).items

  it('a chosen brand applies to every booking of the recipient key', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/logos/recipients/${key}`,
      headers: { cookie },
      payload: { mode: 'brand', brandSlug: 'thesvg-color:lidl' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ kind: 'brand', slug: 'thesvg-color:lidl' })
    const items = await list()
    const lidl = items.filter((item) => item.recipientKey === 'lidl dienstleistung test')
    expect(lidl).toHaveLength(2)
    for (const item of lidl)
      expect(item).toMatchObject({ logo: { slug: 'thesvg-color:lidl' }, logoSource: 'manual' })
    expect(items.find((item) => item.counterparty === 'REWE Wahltest')!.logoSource).toBe('auto')
  })

  it('"Kein Logo" suppresses the match, delete goes back to automatic', async () => {
    const reweKey = encodeURIComponent('rewe wahltest')
    await app.inject({
      method: 'PUT',
      url: `/api/logos/recipients/${reweKey}`,
      headers: { cookie },
      payload: { mode: 'none' },
    })
    let rewe = (await list()).find((item) => item.counterparty === 'REWE Wahltest')!
    expect(rewe).toMatchObject({ logo: null, logoSource: null })
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/logos/recipients/${reweKey}`,
      headers: { cookie },
    })
    expect(del.statusCode).toBe(204)
    rewe = (await list()).find((item) => item.counterparty === 'REWE Wahltest')!
    expect(rewe).toMatchObject({ logo: { slug: 'thesvg-color:rewe' }, logoSource: 'auto' })
  })

  it('validates brand and key', async () => {
    const put = (url: string, payload: object) =>
      app.inject({ method: 'PUT', url, headers: { cookie }, payload })
    expect(
      (await put(`/api/logos/recipients/${key}`, { mode: 'brand', brandSlug: 'gibtsnicht' }))
        .statusCode,
    ).toBe(400)
    expect((await put(`/api/logos/recipients/${key}`, { mode: 'brand' })).statusCode).toBe(400)
    expect(
      (await put(`/api/logos/recipients/${key}`, { mode: 'none', brandSlug: 'thesvg-color:lidl' }))
        .statusCode,
    ).toBe(400)
    expect(
      (await put(`/api/logos/recipients/${'x'.repeat(201)}`, { mode: 'none' })).statusCode,
    ).toBe(404)
    const anonymous = await app.inject({
      method: 'PUT',
      url: `/api/logos/recipients/${key}`,
      payload: { mode: 'none' },
    })
    expect(anonymous.statusCode).toBe(401)
  })
})
