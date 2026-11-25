import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { ClassPerformanceResponse, PerformanceResponse, PositionDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('performance lines per asset class (005 US2)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = async <T>(url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    expect(res.statusCode, url).toBe(200)
    return res.json() as T
  }

  it('ends each class line at the sum of that class positions; "Alle" at the depot value', async () => {
    const positions = await get<PositionDto[]>('/api/investments/positions')
    const body = await get<ClassPerformanceResponse>(
      '/api/investments/performance/classes?period=1Y',
    )
    const held = [...new Set(positions.map((row) => row.assetClass))].sort()
    expect(held.length).toBeGreaterThan(1)
    for (const assetClass of held) expect(body.classes).toContain(assetClass)
    const last = body.series.at(-1)!
    for (const assetClass of held) {
      const expected = positions
        .filter((row) => row.assetClass === assetClass)
        .reduce((sum, row) => sum + row.valueCents, 0)
      expect(last.byClass[assetClass]!.valueCents, assetClass).toBe(expected)
    }
    const all = await get<PerformanceResponse>('/api/investments/performance?period=1Y')
    expect(last.total.valueCents).toBe(all.valueCents)
    for (const day of body.series) {
      for (const point of [day.total, ...Object.values(day.byClass)]) {
        expect(point.twrorPct === null || /^-?\d+\.\d{6}$/.test(point.twrorPct)).toBe(true)
      }
    }
  })

  it('rejects an unknown period', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/investments/performance/classes?period=bogus',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
