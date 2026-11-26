import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AllocationResponse, KpiResponse, TopFlopResponse } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoResult } from '../../src/database/demo'
import { createDemoApp } from '../helpers/demo-app'

const expected = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/demo-expected.json'), 'utf8'),
) as { totalCents: number; depotValueCents: number; depotInvestedCents: number; cashCents: number }

describe('overview allocation, KPIs and top/flop', () => {
  let app: NestFastifyApplication
  let cookie: string
  let demo: DemoResult

  beforeAll(async () => {
    ;({ app, cookie, demo } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = async <T>(url: string): Promise<T> => {
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }

  it('splits net worth by asset class plus cash', async () => {
    const body = await get<AllocationResponse>('/api/overview/allocation')
    expect(body.totalCents).toBe(expected.totalCents)
    const keys = body.slices.map((slice) => slice.key)
    expect(keys).toEqual(expect.arrayContaining(['etf', 'stock', 'cash']))
    expect(body.slices.find((slice) => slice.key === 'etf')?.count).toBe(3)
    expect(body.slices.find((slice) => slice.key === 'cash')?.valueCents).toBe(
      expected.totalCents - expected.depotValueCents,
    )
    const pctSum = body.slices.reduce((sum, slice) => sum + Number(slice.pct), 0)
    expect(pctSum).toBeCloseTo(1, 4)
  })

  it('computes KPIs for a period', async () => {
    const body = await get<KpiResponse>('/api/overview/kpis?period=3Y')
    expect(body.investedCents).toBe(expected.depotInvestedCents)
    // SAP was sold within the last 3 years.
    expect(body.realized.grossCents).not.toBe(0)
    expect(body.dividends.netCents).toBeGreaterThan(0)
    expect(body.taxesFeesCents).toBeLessThan(0)
    expect(body.twror).not.toBeNull()
    expect(body.irr).not.toBeNull()
    expect(body.inflation).toBe('0.0253')
    expect(body.totalReturnCents).toBe(
      body.priceGain.cents +
        body.realized.grossCents +
        body.dividends.grossCents +
        body.interest.grossCents +
        body.taxesFeesCents,
    )
  })

  it('returns no realized gains for a period without sells', async () => {
    const body = await get<KpiResponse>('/api/overview/kpis?period=1M')
    expect(body.realized.grossCents).toBe(0)
  })

  it('lists top and flop holdings by price change', async () => {
    const body = await get<TopFlopResponse>('/api/overview/holdings/top-flop?range=1M')
    const all = [...body.top, ...body.flop]
    expect(all.length).toBeGreaterThan(0)
    expect(body.top.every((item) => Number(item.changePct) > 0)).toBe(true)
    expect(body.flop.every((item) => Number(item.changePct) < 0)).toBe(true)
    // SAP is sold and must not appear.
    expect(all.some((item) => item.name === 'SAP SE')).toBe(false)
  })

  it('has no depot KPIs for a cash-only selection', async () => {
    const body = await get<KpiResponse>(`/api/overview/kpis?accounts=${demo.checkingId}`)
    expect(body.investedCents).toBe(0)
    expect(body.twror).toBeNull()
  })
})
