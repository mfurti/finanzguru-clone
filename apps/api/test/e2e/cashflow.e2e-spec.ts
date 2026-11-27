import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type {
  CashflowCategories,
  CashflowSummary,
  SankeyResponse,
  TransactionListItem,
} from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('cash-flow and transaction review API', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = async <T>(method: 'GET' | 'PATCH', url: string, payload?: object) => {
    const res = await app.inject({ method, url, headers: { cookie }, payload })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }

  it('summarizes a demo month with 12 bars', async () => {
    const body = await call<CashflowSummary>('GET', '/api/cashflow/summary?anchor=2026-10-15')
    expect(body.period).toEqual({ from: '2026-10-01', to: '2026-10-31', label: 'Oktober 2026' })
    expect(body.incomeCents).toBe(248000)
    expect(body.balanceCents).toBe(body.incomeCents - body.expenseCents)
    expect(body.bars).toHaveLength(12)
    expect(body.bars.at(-1)?.label).toBe('Oktober 2026')
  })

  it('aggregates by quarter and year', async () => {
    const quarter = await call<CashflowSummary>(
      'GET',
      '/api/cashflow/summary?granularity=quarter&anchor=2026-08-01',
    )
    expect(quarter.period.label).toBe('Q3 2026')
    expect(quarter.incomeCents).toBe(3 * 248000)
    const year = await call<CashflowSummary>(
      'GET',
      '/api/cashflow/summary?granularity=year&anchor=2025-06-01',
    )
    expect(year.incomeCents).toBe(12 * 248000)
  })

  it('builds a Sankey graph and category totals that match the expenses', async () => {
    const summary = await call<CashflowSummary>('GET', '/api/cashflow/summary?anchor=2026-10-15')
    const graph = await call<SankeyResponse>('GET', '/api/cashflow/sankey?anchor=2026-10-15')
    // All category blocks together = expenses; since 013 part of it may come from "Fehlbetrag".
    const intoCategories = graph.links
      .filter((link) => link.target.startsWith('main:'))
      .reduce((sum, link) => sum + link.valueCents, 0)
    expect(intoCategories).toBe(summary.expenseCents)
    const categories = await call<CashflowCategories>(
      'GET',
      '/api/cashflow/categories?anchor=2026-10-15&kind=expense',
    )
    expect(categories.totalCents).toBe(summary.expenseCents)
    expect(categories.items.map((item) => item.name)).toContain('Wohnen')
  })

  it('lists unreviewed transactions and categorizes one with a rule', async () => {
    const unreviewed = await call<{ items: TransactionListItem[]; total: number }>(
      'GET',
      '/api/transactions?status=unreviewed&categoryId=uncategorized',
    )
    expect(unreviewed.total).toBe(3)
    const first = unreviewed.items[0]!
    const groceries = (
      await call<CashflowCategories>('GET', '/api/cashflow/categories?anchor=2026-10-15')
    ).items.find((item) => item.name === 'Lebenshaltung')!

    const result = await call<{ updated: number }>('PATCH', `/api/transactions/${first.id}`, {
      categoryId: groceries.categoryId,
      createRule: { matchField: 'counterparty', operator: 'equals', pattern: first.counterparty },
    })
    expect(result.updated).toBeGreaterThanOrEqual(1)

    const count = await call<{ count: number }>('GET', '/api/transactions/unreviewed/count')
    expect(count.count).toBeLessThan(3)
  })

  it('searches transactions by text', async () => {
    const found = await call<{ items: TransactionListItem[] }>(
      'GET',
      '/api/transactions?q=Hausverwaltung&pageSize=5',
    )
    expect(found.items.length).toBe(5)
    expect(found.items.every((item) => item.counterparty === 'Demo Hausverwaltung')).toBe(true)
  })

  it('rejects rules without category and invalid regex', async () => {
    const list = await call<{ items: TransactionListItem[] }>('GET', '/api/transactions?pageSize=1')
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/transactions/${list.items[0]!.id}`,
      headers: { cookie },
      payload: { createRule: { matchField: 'purpose', operator: 'regex', pattern: '(' } },
    })
    expect(res.statusCode).toBe(400)
  })
})
