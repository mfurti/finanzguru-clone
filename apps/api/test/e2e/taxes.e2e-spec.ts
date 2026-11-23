import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TaxYearDto, VorabpauschaleResponse } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import { DEMO_BASE_RATES, DEMO_END } from '../../src/database/demo'
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
  /** The demo's exemption order lives in the demo's last year. */
  const year = Number(DEMO_END.slice(0, 4))

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

  it('defaults to a single assessment without orders for an unset year', async () => {
    const res = await call('GET', '/api/taxes/2021')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      assessment: 'single',
      allowanceCents: 100_000,
      baseRate: null,
      orders: [],
      exceedsAllowance: false,
    })
    expect((await call('GET', '/api/taxes/abc')).statusCode).toBe(400)
  })

  it('warns when orders exceed the allowance and counts used income per broker (W10)', async () => {
    const start = (await call('GET', `/api/taxes/${year}`)).json() as TaxYearDto
    expect(start.orders).toHaveLength(1)
    const broker = start.orders[0]!
    expect(broker).toMatchObject({ institutionId: brokerId, amountCents: 80_000 })

    const dividends = db
      .select()
      .from(transaction)
      .where(eq(transaction.accountId, depotId))
      .all()
      .filter((tx) => tx.type === 'dividend' && tx.bookingDate.startsWith(String(year)))
      .reduce((sum, tx) => sum + tx.amountCents + tx.taxCents, 0)
    expect(broker.taxableIncomeCents).toBeGreaterThanOrEqual(dividends)
    expect(broker.usedCents).toBe(Math.min(80_000, Math.max(0, broker.taxableIncomeCents)))
    expect(broker.remainingCents).toBe(80_000 - broker.usedCents)

    const second = await call('POST', `/api/taxes/${year}/orders`, {
      institutionId: bankId,
      amountCents: 30_000,
    })
    expect(second.statusCode).toBe(201)
    expect(second.json()).toMatchObject({ totalCents: 110_000, exceedsAllowance: true })

    // Joint assessment doubles the allowance.
    const joint = await call('PUT', `/api/taxes/${year}`, {
      assessment: 'joint',
      baseRate: DEMO_BASE_RATES[year],
    })
    expect(joint.json()).toMatchObject({ allowanceCents: 200_000, exceedsAllowance: false })

    expect(
      (await call('POST', `/api/taxes/${year}/orders`, { institutionId: brokerId, amountCents: 1 }))
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

  it('estimates the Vorabpauschale with the base rate and reports a missing one (W11)', async () => {
    const previous = year - 1
    const result = (
      await call('GET', `/api/taxes/${previous}/vorabpauschale`)
    ).json() as VorabpauschaleResponse
    expect(result.estimate).toBe(true)
    expect(result.baseRate).toBe(DEMO_BASE_RATES[previous])
    expect(result.rows).toHaveLength(3)
    expect(result.rows.every((row) => row.reason === null && row.fundType === 'equity')).toBe(true)
    for (const row of result.rows) {
      expect(row.vorabpauschaleCents).toBeLessThanOrEqual(row.basisertragCents)
      // 30 % partial exemption, half-even rounding.
      expect(Math.abs(row.taxableCents - row.vorabpauschaleCents * 0.7)).toBeLessThanOrEqual(0.5)
    }
    expect(result.totalTaxableCents).toBe(result.rows.reduce((s, r) => s + r.taxableCents, 0))

    expect(
      (await call('PUT', `/api/taxes/${previous}`, { assessment: 'single', baseRate: '0.3' }))
        .statusCode,
    ).toBe(400)
    await call('PUT', `/api/taxes/${previous}`, { assessment: 'single', baseRate: null })
    const missing = (
      await call('GET', `/api/taxes/${previous}/vorabpauschale`)
    ).json() as VorabpauschaleResponse
    expect(missing.rows.every((row) => row.reason === 'base_rate_missing')).toBe(true)
  })
})
