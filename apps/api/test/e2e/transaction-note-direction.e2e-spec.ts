import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TransactionPage } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, transaction } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('booking notes and direction filter (007 T003)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let ids: string[] = []

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Notizbank' }).returning().get()
    const acc = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Giro', type: 'checking' })
      .returning()
      .get()
    ids = [-2500, -800, 4000].map(
      (amountCents, index) =>
        db
          .insert(transaction)
          .values({
            accountId: acc.id,
            bookingDate: `2026-11-0${index + 1}`,
            amountCents,
            type: amountCents < 0 ? 'expense' : 'income',
            source: 'manual',
            counterparty: 'Test',
            counterpartyIban: 'DE02120300000000202051',
            fingerprint: `n-${index}`,
          })
          .returning()
          .get().id,
    )
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const list = async (query: string) =>
    (await call('GET', `/api/transactions?${query}`)).json() as TransactionPage

  it('returns institution, IBAN and note in the list', async () => {
    const page = await list('pageSize=10')
    expect(page.items[0]).toMatchObject({
      institutionName: 'Notizbank',
      counterpartyIban: 'DE02120300000000202051',
      note: null,
    })
  })

  it('saves, trims and clears a note; refuses more than 1 000 characters', async () => {
    expect(
      (await call('PATCH', `/api/transactions/${ids[0]}`, { note: '  Urlaub  ' })).statusCode,
    ).toBe(200)
    expect((await list('pageSize=10')).items.find((item) => item.id === ids[0])!.note).toBe(
      'Urlaub',
    )
    await call('PATCH', `/api/transactions/${ids[0]}`, { note: '' })
    expect((await list('pageSize=10')).items.find((item) => item.id === ids[0])!.note).toBeNull()
    const long = await call('PATCH', `/api/transactions/${ids[0]}`, { note: 'x'.repeat(1001) })
    expect(long.statusCode).toBe(400)
  })

  it('filters incoming and outgoing bookings', async () => {
    expect((await list('direction=out')).items.map((item) => item.amountCents).sort()).toEqual([
      -2500, -800,
    ])
    expect((await list('direction=in')).items.map((item) => item.amountCents)).toEqual([4000])
    expect((await call('GET', '/api/transactions?direction=sideways')).statusCode).toBe(400)
  })
})
