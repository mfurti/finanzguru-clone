import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AssetClassDto, PerformanceResponse, PositionDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

const expected = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/demo-expected.json'), 'utf8'),
) as { depotValueCents: number; depotInvestedCents: number; openPositions: number }

describe('investments API', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = async <T>(url: string): Promise<T> => {
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }

  it('lists open positions with values matching the depot total', async () => {
    const positions = await get<PositionDto[]>('/api/investments/positions')
    expect(positions).toHaveLength(expected.openPositions)
    expect(positions.reduce((sum, row) => sum + row.valueCents, 0)).toBe(expected.depotValueCents)
    expect(positions.reduce((sum, row) => sum + row.entryValueCents, 0)).toBe(
      expected.depotInvestedCents,
    )
    const pctSum = positions.reduce((sum, row) => sum + Number(row.allocationPct), 0)
    expect(pctSum).toBeCloseTo(1, 4)
    const world = positions.find((row) => row.isin === 'IE00B4L5Y983')!
    expect(world).toMatchObject({ wkn: 'A0RPWH', assetClass: 'etf' })
    expect(world.dayChangePct).not.toBeNull()
    expect(world.gainCents).toBe(world.valueCents - world.entryValueCents)
    const dist = positions.find((row) => row.isin === 'IE00B3RBWM25')!
    expect(dist.dividendsCents).toBeGreaterThan(0)
  })

  it('filters by asset class', async () => {
    const stocks = await get<PositionDto[]>('/api/investments/positions?assetClass=stock')
    expect(stocks.map((row) => row.name)).toEqual(['Apple Inc.'])
  })

  it('lists sold positions with realized results', async () => {
    const sold = await get<PositionDto[]>('/api/investments/positions?status=sold')
    expect(sold).toHaveLength(1)
    expect(sold[0]).toMatchObject({ name: 'SAP SE', valueCents: 0 })
    expect(sold[0]?.realizedCents).not.toBe(0)
  })

  it('groups by asset class', async () => {
    const classes = await get<AssetClassDto[]>('/api/investments/asset-classes')
    expect(classes.map((row) => [row.assetClass, row.count])).toEqual([
      ['etf', 3],
      ['stock', 1],
    ])
  })

  it('returns a performance series for the depot', async () => {
    const body = await get<PerformanceResponse>('/api/investments/performance?period=1Y')
    expect(body.valueCents).toBe(expected.depotValueCents)
    expect(body.series.length).toBeGreaterThan(300)
    expect(body.series.every((point) => point.investedCents > 0)).toBe(true)
  })
})
