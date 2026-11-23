import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TaxYearDto, VorabpauschaleResponse } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { institution, transaction } from '../../src/database/schema'
import { createDemoApp } from '../helpers/demo-app'

describe('Steuern (US4)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let brokerId: string
  let bankId: string
  let depotId: string
  const year = new Date().getUTCFullYear()

  beforeAll(async () => {
    let demo
    ;({ app, cookie, demo } = await createDemoApp())
    depotId = demo.depotId
    db = app.get<AppDatabase>(DB)
    brokerId = db.select().from(institution).where(eq(institution.name, 'Demo Broker')).get()!.id
    bankId = db.select().from(institution).where(eq(institution.name, 'Demo Bank')).get()!.id
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) => app.inject({ method, url, headers: { cookie }, payload })

  it('starts with a single assessment and no orders', async () => {
    const res = await call('GET', `/api/taxes/${year}`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      assessment: 'single',
      allowanceCents: 100_000,
      orders: [],
      exceedsAllowance: false,
    })
    expect((await call('GET', '/api/taxes/abc')).statusCode).toBe(400)
  })

  it('warns when orders exceed the allowance and counts used income per broker (W10)', async () => {
    expect(
      (
        await call('POST', `/api/taxes/${year}/orders`, {
          institutionId: brokerId,
          amountCents: 80_000,
        })
      ).statusCode,
    ).toBe(201)
    const second = await call('POST', `/api/taxes/${year}/orders`, {
      institutionId: bankId,
      amountCents: 30_000,
    })
    const dto = second.json() as TaxYearDto
    expect(dto.totalCents).toBe(110_000)
    expect(dto.exceedsAllowance).toBe(true)

    const dividends = db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, depotId))
      .all()
      .filter((tx) => tx.type === 'dividend' && tx.bookingDate.startsWith(String(year)))
      .reduce((sum, tx) => sum + tx.amountCents + tx.taxCents, 0)
    const broker = dto.orders.find((o) => o.institutionId === brokerId)!
    expect(broker.taxableIncomeCents).toBeGreaterThanOrEqual(dividends)
    expect(broker.usedCents).toBe(Math.min(80_000, Math.max(0, broker.taxableIncomeCents)))
    expect(broker.remainingCents).toBe(80_000 - broker.usedCents)

    // Joint assessment doubles the allowance.
    const joint = await call('PUT', `/api/taxes/${year}`, { assessment: 'joint' })
    expect(joint.json()).toMatchObject({ allowanceCents: 200_000, exceedsAllowance: false })

    expect(
      (await call('POST', `/api/taxes/${year}/orders`, { institutionId: bankId, amountCents: 1 }))
        .statusCode,
    ).toBe(409)
    expect(
      (await call('POST', `/api/taxes/${year}/orders`, { institutionId: bankId, amountCents: -1 }))
        .statusCode,
    ).toBe(400)

    const updated = await call('PATCH', `/api/taxes/orders/${broker.id}`, { amountCents: 50_000 })
    expect(updated.json().totalCents).toBe(80_000)
    expect((await call('DELETE', `/api/taxes/orders/${broker.id}`)).statusCode).toBe(204)
    expect((await call('DELETE', `/api/taxes/orders/${broker.id}`)).statusCode).toBe(404)
  })

  it('estimates the Vorabpauschale once a base rate is set (W11)', async () => {
    await call('PUT', `/api/taxes/${year - 1}`, { assessment: 'single' })
    const missing = (
      await call('GET', `/api/taxes/${year - 1}/vorabpauschale`)
    ).json() as VorabpauschaleResponse
    expect(missing.estimate).toBe(true)
    expect(missing.rows.length).toBe(3)
    expect(missing.rows.every((row) => row.reason === 'base_rate_missing')).toBe(true)

    expect(
      (await call('PUT', `/api/taxes/${year - 1}`, { assessment: 'single', baseRate: '0.3' }))
        .statusCode,
    ).toBe(400)
    await call('PUT', `/api/taxes/${year - 1}`, { assessment: 'single', baseRate: '0.0253' })
    const result = (
      await call('GET', `/api/taxes/${year - 1}/vorabpauschale`)
    ).json() as VorabpauschaleResponse
    expect(result.baseRate).toBe('0.0253')
    expect(result.rows.every((row) => row.reason === null)).toBe(true)
    expect(result.rows.every((row) => row.fundType === 'equity')).toBe(true)
    for (const row of result.rows) {
      expect(row.vorabpauschaleCents).toBeLessThanOrEqual(row.basisertragCents)
      // 30 % partial exemption, half-even rounding.
      expect(Math.abs(row.taxableCents - row.vorabpauschaleCents * 0.7)).toBeLessThanOrEqual(0.5)
    }
    expect(result.totalTaxableCents).toBe(result.rows.reduce((s, r) => s + r.taxableCents, 0))
  })
})
