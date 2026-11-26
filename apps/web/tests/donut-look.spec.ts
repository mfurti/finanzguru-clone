import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { CashflowCategories, DividendSummary } from '@finance/shared'
import { describe, expect, it } from 'vitest'
import CategoryDonut from '~/components/budget/CategoryDonut.vue'
import DonutChart from '~/components/common/DonutChart.vue'
import DividendSplit from '~/components/dividends/DividendSplit.vue'

/** The dashboard Aufteilung donut (DonutChart defaults) is the one look (011 US2). */
const items = [
  { key: 'a', value: 6000, color: '#7fdcb5', label: 'A' },
  { key: 'b', value: 4000, color: '#82c3f0', label: 'B' },
]
const sizeOf = (html: { attributes: (name: string) => string | undefined }) => [
  html.attributes('width'),
  html.attributes('height'),
]

describe('one donut look (011 T007)', () => {
  it('budget categories and dividends draw the dashboard donut size', async () => {
    const dashboard = await mountSuspended(DonutChart, { props: { items } })
    const reference = sizeOf(dashboard.get('[data-testid="donut-chart"]'))

    const categories = await mountSuspended(CategoryDonut, {
      props: {
        items: [
          { categoryId: 'c1', name: 'Wohnen', totalCents: 6000, count: 1 },
          { categoryId: 'c2', name: 'Freizeit', totalCents: 4000, count: 2 },
        ] as unknown as CashflowCategories['items'],
        totalCents: 10000,
        sign: -1,
        kind: 'expense' as const,
        colors: () => '#7fdcb5',
      },
    })
    expect(sizeOf(categories.get('[data-testid="donut-chart"]'))).toEqual(reference)
    expect(categories.get('[data-testid="donut-center-label"]').classes()).toContain('text-xs')

    const dividends = await mountSuspended(DividendSplit, {
      props: {
        summary: {
          bySecurity: [
            { instrumentId: 'i1', name: 'ETF Welt', cents: 1500, pct: '0.75' },
            { instrumentId: 'i2', name: 'ETF Europa', cents: 500, pct: '0.25' },
          ],
          byRegion: [],
          bySector: [],
        } as unknown as DividendSummary,
      },
    })
    expect(sizeOf(dividends.get('[data-testid="donut-chart"]'))).toEqual(reference)
    expect(dividends.get('[data-testid="dividend-split-center"]').text()).toBe('Dividenden gesamt')
    expect(dividends.get('[data-testid="dividend-split"]').text()).toContain('20,00')
  })
})
