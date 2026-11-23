import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { NetWorthResponse } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoResult } from '../../src/database/demo'
import { createDemoApp } from '../helpers/demo-app'

const expected = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/demo-expected.json'), 'utf8'),
) as { totalCents: number; cashCents: number }

describe('GET /api/overview/net-worth', () => {
  let app: NestFastifyApplication
  let cookie: string
  let demo: DemoResult

  beforeAll(async () => {
    ;({ app, cookie, demo } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = async (query: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/overview/net-worth${query}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    return res.json() as NetWorthResponse
  }

  it('totals depot values and cash to the cent', async () => {
    const body = await get('?period=1Y')
    expect(body.totalCents).toBe(expected.totalCents)
    expect(body.series.at(-1)?.valueCents).toBe(expected.totalCents)
    expect(body.series.at(-1)?.cashCents).toBe(expected.cashCents)
  })

  it('caps the series at 400 points and keeps the last day', async () => {
    const all = await get('?period=ALL')
    expect(all.series.length).toBeLessThanOrEqual(400)
    expect(all.series.at(-1)?.valueCents).toBe(expected.totalCents)
    const week = await get('?period=1W')
    expect(week.series).toHaveLength(8)
  })

  it('reports gain net of external flows and a cumulative return', async () => {
    const body = await get('?period=1Y&mode=return')
    expect(Number.isInteger(body.gainCents)).toBe(true)
    expect(body.series[0]?.returnPct).toBe('0')
    expect(body.series.at(-1)?.returnPct).not.toBeNull()
  })

  it('restricts to selected accounts', async () => {
    const body = await get(`?period=1M&accounts=${demo.checkingId}`)
    expect(body.totalCents).toBe(237737)
    expect(body.series.every((point) => point.investedCents === point.valueCents)).toBe(true)
  })

  it('returns an empty series for unknown accounts and validates the period', async () => {
    expect((await get('?accounts=does-not-exist')).series).toEqual([])
    const res = await app.inject({
      method: 'GET',
      url: '/api/overview/net-worth?period=2Y',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
