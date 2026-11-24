import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { ChartSettings, NetWorthResponse } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('net-worth custom range and chart menu (003 US6)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('covers exactly the custom range', async () => {
    const res = await call('GET', '/api/overview/net-worth?from=2026-03-01&to=2026-06-30')
    expect(res.statusCode).toBe(200)
    const body = res.json() as NetWorthResponse
    expect(body.series[0]!.date).toBe('2026-03-01')
    expect(body.series.at(-1)!.date).toBe('2026-06-30')
  })

  it('starts a range longer than the data at the first data point', async () => {
    const body = (
      await call('GET', '/api/overview/net-worth?from=1990-01-01&to=2026-06-30')
    ).json() as NetWorthResponse
    const all = (await call('GET', '/api/overview/net-worth?period=ALL')).json() as NetWorthResponse
    expect(body.series[0]!.date).toBe(all.series[0]!.date)
    expect(
      (await call('GET', '/api/overview/net-worth?from=2026-07-01&to=2026-06-01')).statusCode,
    ).toBe(400)
  })

  it('remembers "Investiertes Kapital" without touching the benchmarks', async () => {
    const before = (await call('GET', '/api/settings/charts')).json() as ChartSettings
    expect(before.networthShowInvested).toBe(true)
    const saved = await call('PUT', '/api/settings/charts', {
      networthBenchmark: before.networthBenchmark,
      investmentsBenchmark: before.investmentsBenchmark,
      networthShowInvested: false,
    })
    expect(saved.json()).toMatchObject({ networthShowInvested: false })
    await call('PUT', '/api/settings/charts', {
      networthBenchmark: null,
      investmentsBenchmark: null,
    })
    expect(
      ((await call('GET', '/api/settings/charts')).json() as ChartSettings).networthShowInvested,
    ).toBe(false)
  })
})
