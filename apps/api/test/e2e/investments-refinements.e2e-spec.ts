import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type {
  DividendSummary,
  InvestmentTransactionRow,
  InvestmentTransactionsResponse,
  ReturnsResponse,
  VorabpauschaleResponse,
} from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('investments refinements (003 US5)', () => {
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

  it('sorts bookings by every column and filters by types and amount', async () => {
    const key: Record<string, (row: InvestmentTransactionRow) => string | number> = {
      type: (row) => row.type,
      name: (row) => (row.instrumentName ?? '').toLowerCase(),
      account: (row) => row.accountName.toLowerCase(),
      tax: (row) => row.taxCents,
      fee: (row) => row.feeCents,
    }
    for (const [sort, read] of Object.entries(key)) {
      const { items } = await get<InvestmentTransactionsResponse>(
        `/api/investments/transactions?sort=${sort}&dir=asc&pageSize=200`,
      )
      const values = items.map(read)
      expect(values, sort).toEqual([...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    }
    const filtered = await get<InvestmentTransactionsResponse>(
      '/api/investments/transactions?types=buy,dividend&maxCents=0&pageSize=200',
    )
    expect(filtered.items.length).toBeGreaterThan(0)
    expect(filtered.items.every((row) => ['buy', 'dividend'].includes(row.type))).toBe(true)
    expect(filtered.items.every((row) => row.amountCents <= 0)).toBe(true)
  })

  it('returns trailing periods with the analysis returns', async () => {
    const body = await get<ReturnsResponse>('/api/analysis/returns?period=1Y')
    expect(body.trailing.map((row) => row.period)).toEqual([
      '1M',
      '3M',
      'YTD',
      '1Y',
      '3Y',
      '5Y',
      'ALL',
    ])
    for (const row of body.trailing)
      expect(row.from <= new Date().toISOString().slice(0, 10)).toBe(true)
  })

  it('splits dividends by region and sector, each summing to the total', async () => {
    const body = await get<DividendSummary>('/api/dividends/summary')
    const total = body.bySecurity.reduce((sum, row) => sum + row.cents, 0)
    expect(total).toBeGreaterThan(0)
    for (const split of [body.byRegion, body.bySector]) {
      expect(split.length).toBeGreaterThan(0)
      expect(split.reduce((sum, row) => sum + row.cents, 0)).toBe(total)
      expect(split.every((row) => row.label.length > 0)).toBe(true)
    }
  })

  it('groups the Vorabpauschale per broker with subtotals', async () => {
    const body = await get<VorabpauschaleResponse>('/api/taxes/2026/vorabpauschale')
    expect(body.brokers.length).toBeGreaterThan(0)
    const sum = body.brokers.reduce((acc, group) => acc + group.subtotalCents, 0)
    expect(sum).toBe(body.totalTaxableCents)
    for (const group of body.brokers) {
      expect(group.rows.every((row) => row.broker === group.broker)).toBe(true)
      expect(group.subtotalCents).toBe(group.rows.reduce((acc, row) => acc + row.taxableCents, 0))
    }
  })
})
