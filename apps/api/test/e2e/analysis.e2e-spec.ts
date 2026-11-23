import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type {
  BreakdownResponse,
  CompareResponse,
  GroupingDto,
  ReturnsResponse,
} from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { instrument } from '../../src/database/schema'
import expected from '../fixtures/demo-expected.json'
import { createDemoApp } from '../helpers/demo-app'

describe('Analyse (US1)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let worldId: string
  let appleId: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
    db = app.get<AppDatabase>(DB)
    worldId = db.select().from(instrument).where(eq(instrument.isin, 'IE00B4L5Y983')).get()!.id
    appleId = db.select().from(instrument).where(eq(instrument.isin, 'US0378331005')).get()!.id
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = <T>(url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } }).then((res) => {
      expect(res.statusCode, `${url}: ${res.body}`).toBe(200)
      return res.json() as T
    })
  const send = (method: 'PUT' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  const sum = (r: BreakdownResponse) => r.buckets.reduce((a, b) => a + b.valueCents, 0)

  it('splits by every dimension and always adds up to the depot value (SC-001)', async () => {
    for (const dimension of [
      'assetClass',
      'region',
      'sector',
      'currency',
      'volatility',
      'return',
    ]) {
      const result = await get<BreakdownResponse>(`/api/analysis/breakdown?dimension=${dimension}`)
      expect(result.totalCents).toBe(expected.depotValueCents)
      expect(sum(result), dimension).toBe(expected.depotValueCents)
    }
  })

  it('stores weights, rejects sums above 100 % and uses them in the region split', async () => {
    const tooMuch = await send('PUT', `/api/instruments/${worldId}/classification`, {
      fundType: 'equity',
      isBenchmark: false,
      weights: {
        region: [
          { key: 'north_america', weight: '0.7' },
          { key: 'europe', weight: '0.4' },
        ],
        sector: [],
        currency: [],
      },
    })
    expect(tooMuch.statusCode).toBe(400)
    expect(tooMuch.json().statusMessage).toContain('Summe 110 %')

    const ok = await send('PUT', `/api/instruments/${worldId}/classification`, {
      fundType: 'equity',
      isBenchmark: false,
      weights: {
        region: [
          { key: 'north_america', weight: '0.7' },
          { key: 'europe', weight: '0.2' },
        ],
        sector: [{ key: 'information_technology', weight: '0.25' }],
        currency: [{ key: 'USD', weight: '0.7' }],
      },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().weights.region).toHaveLength(2)

    const regions = await get<BreakdownResponse>('/api/analysis/breakdown?dimension=region')
    expect(regions.buckets.map((b) => b.key)).toEqual(
      expect.arrayContaining(['north_america', 'europe', 'unassigned']),
    )
    expect(regions.buckets.find((b) => b.key === 'unassigned')!.label).toBe('Nicht zugeordnet')
    expect(sum(regions)).toBe(expected.depotValueCents)

    const currencies = await get<BreakdownResponse>('/api/analysis/breakdown?dimension=currency')
    // Unclassified instruments default to their trading currency (EUR in the demo).
    expect(currencies.buckets.find((b) => b.key === 'EUR')).toBeDefined()
  })

  it('returns monthly, yearly and cumulative returns', async () => {
    const result = await get<ReturnsResponse>('/api/analysis/returns?period=ALL')
    expect(result.series.length).toBeGreaterThan(10)
    expect(result.series[0]!.twror).toBe('0')
    expect(result.months.length).toBeGreaterThan(12)
    const current = result.years.at(-1)!
    expect(current.ytd).toBe(true)
    expect(current.inflation).toBe('0.0253')
  })

  it('uses yearly inflation rates when set', async () => {
    const year = new Date().getUTCFullYear()
    const put = await send('PUT', '/api/settings/inflation', { rates: [{ year, rate: '0.03' }] })
    expect(put.statusCode).toBe(200)
    const result = await get<ReturnsResponse>('/api/analysis/returns')
    expect(result.years.find((y) => y.year === year)!.inflation).toBe('0.03')
    const bad = await send('PUT', '/api/settings/inflation', {
      rates: [{ year: 1900, rate: '0.03' }],
    })
    expect(bad.statusCode).toBe(400)
  })

  it('compares depots from a common start at 0 %', async () => {
    const result = await get<CompareResponse>('/api/analysis/compare?period=1Y')
    expect(result.series).toHaveLength(1)
    expect(result.series[0]!.points[0]!.twror).toBe('0')
  })

  it('manages custom groupings and their members', async () => {
    const created = await send('POST', '/api/groupings', {
      name: 'Test-Aufteilung',
      groups: ['Kern', 'Satellit'],
    })
    expect(created.statusCode).toBe(201)
    const grouping = created.json() as GroupingDto
    expect(
      (await send('POST', '/api/groupings', { name: 'Test-Aufteilung', groups: ['A'] })).statusCode,
    ).toBe(409)

    const kern = grouping.groups.find((g) => g.name === 'Kern')!.id
    const satellit = grouping.groups.find((g) => g.name === 'Satellit')!.id
    const members = await send('PUT', `/api/groupings/${grouping.id}/members`, {
      members: [
        { instrumentId: worldId, groupId: kern },
        { instrumentId: appleId, groupId: satellit },
      ],
    })
    expect(members.statusCode).toBe(200)
    expect(
      (
        await send('PUT', `/api/groupings/${grouping.id}/members`, {
          members: [{ instrumentId: worldId, groupId: 'other' }],
        })
      ).statusCode,
    ).toBe(400)

    const split = await get<BreakdownResponse>(
      `/api/analysis/breakdown?dimension=grouping&groupingId=${grouping.id}`,
    )
    expect(split.buckets.map((b) => b.label)).toEqual(
      expect.arrayContaining(['Kern', 'Satellit', 'Nicht zugeordnet']),
    )
    expect(sum(split)).toBe(expected.depotValueCents)

    // Renaming keeps "Kern" (and its member), drops "Satellit".
    const updated = await send('PATCH', `/api/groupings/${grouping.id}`, {
      name: 'Kern und Rest',
      groups: ['Kern', 'Beimischung'],
    })
    expect(updated.json().members).toEqual([{ instrumentId: worldId, groupId: kern }])
    expect((await send('DELETE', `/api/groupings/${grouping.id}`)).statusCode).toBe(204)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/analysis/breakdown?dimension=grouping&groupingId=${grouping.id}`,
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(400)
  })
})
