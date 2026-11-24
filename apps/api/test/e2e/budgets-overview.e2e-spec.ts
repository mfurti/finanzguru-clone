import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { BudgetsOverview, CategoryNode } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('budgets overview (003 US4)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('is empty without budgets', async () => {
    const body = (
      await call('GET', '/api/budgets/overview?period=2026-10')
    ).json() as BudgetsOverview
    expect(body.rows).toEqual([])
    expect(body.total).toMatchObject({ limitCents: 0, spentCents: 0, diffCents: 0 })
    expect(body.series).toHaveLength(12)
    expect(body.series.every((point) => point.total.budgetCents === null)).toBe(true)
  })

  it('sums budgets into Gesamtbudget and marks overruns', async () => {
    const tree = (await call('GET', '/api/categories')).json() as CategoryNode[]
    const id = (name: string) => tree.find((c) => c.name === name)!.id
    await call('POST', '/api/budgets', {
      categoryId: id('Lebenshaltung'),
      monthlyLimitCents: 50000,
    })
    await call('POST', '/api/budgets', { categoryId: id('Wohnen'), monthlyLimitCents: 90000 })

    const month = new Date().toISOString().slice(0, 7)
    const body = (
      await call('GET', `/api/budgets/overview?period=${month}`)
    ).json() as BudgetsOverview
    expect(body.period).toBe(month)
    expect(body.rows.map((row) => row.name).sort()).toEqual(['Lebenshaltung', 'Wohnen'])
    expect(body.total.limitCents).toBe(140000)
    expect(body.total.spentCents).toBe(body.rows.reduce((sum, row) => sum + row.spentCents, 0))
    expect(body.total.diffCents).toBe(body.total.limitCents - body.total.spentCents)
    for (const row of body.rows) {
      expect(row.diffCents).toBe(row.limitCents - row.spentCents)
      expect(Number(row.ratio)).toBeCloseTo(row.spentCents / row.limitCents, 3)
    }
    const last = body.series.at(-1)!
    expect(last.month).toBe(month)
    expect(last.total.budgetCents).toBe(140000)
    // Budgets created this month: earlier months have no budget (gap).
    expect(body.series[0]!.total.budgetCents).toBeNull()
    expect(body.series[0]!.total.spentCents).toBeGreaterThan(0)
    expect((await call('GET', '/api/budgets/overview?period=2026-13')).statusCode).toBe(400)
  })
})
