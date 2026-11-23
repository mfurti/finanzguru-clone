import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { BenchmarkDto, BenchmarkSeries } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('Vergleichen mit (US5)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let benchmarkId: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    const created = await app.inject({
      method: 'POST',
      url: '/api/instruments',
      headers: { cookie },
      payload: { isin: 'IE00B5BMR087', name: 'S&P 500 ETF', isBenchmark: true },
    })
    benchmarkId = created.json().id
    await app.inject({
      method: 'POST',
      url: `/api/instruments/${benchmarkId}/prices`,
      headers: { cookie },
      payload: {
        prices: [
          { date: '2026-01-02', close: '500' },
          { date: '2026-06-01', close: '550' },
          { date: '2026-11-20', close: '600' },
        ],
      },
    })
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('lists benchmarks with their price range', async () => {
    const list = (await call('GET', '/api/benchmarks')).json() as BenchmarkDto[]
    expect(list).toEqual([
      {
        instrumentId: benchmarkId,
        name: 'S&P 500 ETF',
        isin: 'IE00B5BMR087',
        firstDate: '2026-01-02',
        lastDate: '2026-11-20',
      },
    ])
  })

  it('returns the price change over the requested range', async () => {
    const series = (
      await call('GET', `/api/benchmarks/${benchmarkId}/series?from=2026-01-02&to=2026-11-20`)
    ).json() as BenchmarkSeries
    expect(series.points[0]).toEqual({ date: '2026-01-02', return: '0' })
    expect(series.points.at(-1)).toEqual({ date: '2026-11-20', return: '0.2' })
    expect(series.stale).toBe(false)
    expect((await call('GET', '/api/benchmarks/nope/series')).statusCode).toBe(404)
  })

  it('remembers the selection per chart', async () => {
    expect((await call('GET', '/api/settings/charts')).json()).toEqual({
      networthBenchmark: null,
      investmentsBenchmark: null,
    })
    const saved = await call('PUT', '/api/settings/charts', {
      networthBenchmark: benchmarkId,
      investmentsBenchmark: null,
    })
    expect(saved.json()).toEqual({ networthBenchmark: benchmarkId, investmentsBenchmark: null })
    expect((await call('GET', '/api/settings/charts')).json().networthBenchmark).toBe(benchmarkId)
    expect(
      (
        await call('PUT', '/api/settings/charts', {
          networthBenchmark: 'nope',
          investmentsBenchmark: null,
        })
      ).statusCode,
    ).toBe(400)
  })
})
