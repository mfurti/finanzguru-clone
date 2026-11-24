import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { PerformanceResponse, PositionDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('performance by asset class (004 US2)', () => {
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

  it('equals the sum of that class positions for every class', async () => {
    const positions = await get<PositionDto[]>('/api/investments/positions')
    const classes = [...new Set(positions.map((row) => row.assetClass))]
    expect(classes.length).toBeGreaterThan(1)
    let total = 0
    for (const assetClass of classes) {
      const body = await get<PerformanceResponse>(
        `/api/investments/performance?period=1Y&assetClass=${assetClass}`,
      )
      const expected = positions
        .filter((row) => row.assetClass === assetClass)
        .reduce((sum, row) => sum + row.valueCents, 0)
      expect(body.valueCents, assetClass).toBe(expected)
      expect(body.series.every((point) => Number.isFinite(point.valueCents))).toBe(true)
      total += body.valueCents
    }
    const all = await get<PerformanceResponse>('/api/investments/performance?period=1Y')
    expect(total).toBe(all.valueCents)
  })

  it('shows 0 for a class without holdings and rejects unknown classes', async () => {
    const body = await get<PerformanceResponse>(
      '/api/investments/performance?period=1Y&assetClass=crypto',
    )
    expect(body.valueCents).toBe(0)
    expect(body.series.every((point) => point.valueCents === 0)).toBe(true)
    const bad = await app.inject({
      method: 'GET',
      url: '/api/investments/performance?assetClass=gold-bars',
      headers: { cookie },
    })
    expect(bad.statusCode).toBe(400)
  })
})
