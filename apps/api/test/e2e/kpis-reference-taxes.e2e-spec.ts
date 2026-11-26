import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { KpiResponse } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, transaction } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('Kennzahlen: taxes on the broker cash account (010 T005)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let ids: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Steuerbroker' }).returning().get()
    const depot = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Depot', type: 'depot' })
      .returning()
      .get()
    const reference = db
      .insert(account)
      .values({
        institutionId: inst.id,
        name: 'Referenzkonto',
        type: 'reference',
        parentAccountId: depot.id,
      })
      .returning()
      .get()
    const today = new Date().toISOString().slice(0, 10)
    const rows = [
      { type: 'tax' as const, amountCents: -495, purpose: 'Kapitalertragsteuer' },
      { type: 'tax' as const, amountCents: 100, purpose: 'Steuererstattung' },
      { type: 'fee' as const, amountCents: -499, purpose: 'Entgelt Broker-Abo' },
    ]
    rows.forEach((row, index) =>
      db
        .insert(transaction)
        .values({
          accountId: reference.id,
          bookingDate: today,
          source: 'manual',
          fingerprint: `kpi-tax-${index}`,
          ...row,
        })
        .run(),
    )
    ids = `${depot.id},${reference.id}`
  })
  afterAll(() => app.close())

  it('counts paid taxes minus refunds, not subscription fees', async () => {
    const res = await app.inject({
      url: `/api/overview/kpis?period=1Y&accounts=${ids}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as KpiResponse).taxesFeesCents).toBe(-395)
  })
})
