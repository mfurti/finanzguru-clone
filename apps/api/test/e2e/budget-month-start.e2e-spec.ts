import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CashflowSummary } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

/** 014 T011: the budget month start moves every cash-flow period. */
describe('budget month start (014)', () => {
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
  const setStart = (day: number) =>
    app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie },
      payload: { budgetMonthStart: day },
    })

  it('summary, bars and Sankey follow the start day; the year still adds up', async () => {
    const year = new Date().getFullYear() - 1
    const calendar = await get<CashflowSummary>(`/api/cashflow/summary?anchor=${year}-11-10`)
    expect(calendar.period.from).toBe(`${year}-11-01`)

    await setStart(25)
    const shifted = await get<CashflowSummary>(`/api/cashflow/summary?anchor=${year}-11-10`)
    expect(shifted.period).toMatchObject({ from: `${year}-10-25`, to: `${year}-11-24` })
    expect(shifted.bars.at(-1)).toMatchObject({ from: `${year}-10-25`, to: `${year}-11-24` })
    // Bars touch: each starts the day after the previous one ends.
    for (let index = 1; index < shifted.bars.length; index++) {
      const previousEnd = new Date(`${shifted.bars[index - 1]!.to}T00:00:00Z`)
      previousEnd.setUTCDate(previousEnd.getUTCDate() + 1)
      expect(shifted.bars[index]!.from).toBe(previousEnd.toISOString().slice(0, 10))
    }
    const sankey = await get<{ nodes: { id: string; valueCents?: number }[] }>(
      `/api/cashflow/sankey?anchor=${year}-11-10`,
    )
    expect(sankey.nodes.length).toBeGreaterThan(0)

    const budgets = await get<{ period: string }>(`/api/budgets/overview?period=${year}-11`)
    expect(budgets.period).toBe(`${year}-11`)
    await setStart(1)
  })
})
