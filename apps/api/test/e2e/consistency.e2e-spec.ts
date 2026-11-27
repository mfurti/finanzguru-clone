import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type {
  AccountsOverview,
  CashflowCategories,
  CashflowSummary,
  NetWorthResponse,
  SankeyResponse,
} from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addMonths } from '../../src/domain/period'
import { DEMO_END } from '../../src/database/demo'
import { createDemoApp } from '../helpers/demo-app'

/**
 * 013 US1: the same figure is equal on every page – net worth (chart total, Aufteilung,
 * Portfolios & Konten), cash flow (summary, Sankey) and categories (Σ = Ausgaben gesamt) –
 * for several periods and account selections.
 */
describe('figures are consistent across pages (013 T004)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let selections: [string, string][]

  beforeAll(async () => {
    let demo
    ;({ app, cookie, demo } = await createDemoApp())
    selections = [
      ['alle Konten', ''],
      ['Depot', demo.depotId],
      ['Girokonto', demo.checkingId],
      ['Depot + Verrechnung', `${demo.depotId},${demo.referenceId}`],
    ]
  })
  afterAll(() => app.close())

  const get = async <T>(url: string): Promise<T> => {
    const res = await app.inject({ url, headers: { cookie } })
    expect(res.statusCode, `${url}: ${res.body}`).toBe(200)
    return res.json() as T
  }
  const q = (accounts: string) => (accounts ? `accounts=${accounts}` : '')

  it('net worth: chart total = Aufteilung = Portfolios & Konten', async () => {
    const overview = await get<AccountsOverview>('/api/accounts/overview')
    const rows = overview.groups.flatMap((group) => group.rows)
    for (const [name, accounts] of selections) {
      const chart = await get<NetWorthResponse>(`/api/overview/net-worth?period=1Y&${q(accounts)}`)
      const allocation = await get<{ totalCents: number }>(
        `/api/overview/allocation?${q(accounts)}`,
      )
      const ids = accounts ? accounts.split(',') : rows.map((row) => row.id)
      const listed = rows
        .filter((row) => ids.includes(row.id))
        .reduce((sum, row) => sum + row.balanceCents, 0)
      expect(chart.totalCents, `${name}: chart vs. Aufteilung`).toBe(allocation.totalCents)
      expect(allocation.totalCents, `${name}: Aufteilung vs. Portfolios & Konten`).toBe(listed)
    }
  })

  it('cash flow: summary = Sankey, Σ categories = Ausgaben gesamt', async () => {
    const periods: [string, string][] = [
      ['Monat', `granularity=month&anchor=${DEMO_END}`],
      ['Vormonat', `granularity=month&anchor=${addMonths(DEMO_END, -1)}`],
      ['Quartal', `granularity=quarter&anchor=${DEMO_END}`],
      ['Jahr', `granularity=year&anchor=${DEMO_END}`],
    ]
    for (const [name, accounts] of selections) {
      for (const [label, period] of periods) {
        const where = `${name}, ${label}`
        const params = `${period}&${q(accounts)}`
        const summary = await get<CashflowSummary>(`/api/cashflow/summary?${params}`)
        const sankey = await get<SankeyResponse>(`/api/cashflow/sankey?${params}`)
        const categories = await get<CashflowCategories>(
          `/api/cashflow/categories?${params}&kind=expense`,
        )
        const kind = new Map(sankey.nodes.map((node) => [node.id, node.kind]))
        const sumFrom = (source: string) =>
          sankey.links
            .filter((link) => kind.get(link.source) === source)
            .reduce((sum, link) => sum + link.valueCents, 0)
        const intoCategories = sankey.links
          .filter((link) => kind.get(link.target) === 'main')
          .reduce((sum, link) => sum + link.valueCents, 0)
        // Einnahmen never shows more than the real income; the rest is "Fehlbetrag" (013).
        expect(sumFrom('income'), `${where}: Sankey Einnahmen`).toBe(summary.incomeCents)
        expect(sumFrom('deficit'), `${where}: Sankey Fehlbetrag`).toBe(
          Math.max(0, summary.expenseCents - summary.incomeCents),
        )
        expect(intoCategories, `${where}: Sankey Ausgaben`).toBe(summary.expenseCents)
        expect(categories.totalCents, `${where}: Kategorien gesamt`).toBe(summary.expenseCents)
        expect(
          categories.items.reduce((sum, item) => sum + item.totalCents, 0),
          `${where}: Σ Kategorien`,
        ).toBe(categories.totalCents)
      }
    }
  })
})
