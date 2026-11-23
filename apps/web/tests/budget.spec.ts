import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import CategoryList from '~/components/budget/CategoryList.vue'
import PeriodSwitcher from '~/components/budget/PeriodSwitcher.vue'
import SummaryTiles from '~/components/budget/SummaryTiles.vue'

registerEndpoint('/api/cashflow/categories', () => ({
  totalCents: 177824,
  count: 42,
  items: [
    {
      categoryId: 'wohnen',
      name: 'Wohnen',
      color: 'blue',
      count: 3,
      totalCents: 84500,
      pct: '0.47',
      children: [],
    },
    {
      categoryId: 'leben',
      name: 'Lebenshaltung',
      color: 'green',
      count: 16,
      totalCents: 48453,
      pct: '0.27',
      children: [],
    },
  ],
}))
registerEndpoint('/api/transactions', () => ({ items: [], total: 0 }))

describe('SummaryTiles', () => {
  it('shows income, expenses, balance, saved and savings rate', async () => {
    const wrapper = await mountSuspended(SummaryTiles, {
      props: {
        summary: {
          period: { from: '2026-11-01', to: '2026-11-30', label: 'November 2026' },
          incomeCents: 164401,
          expenseCents: 177824,
          balanceCents: -13423,
          savedCents: 5000,
          savingsRate: '0.0304',
          bars: [],
        },
      },
      global: { stubs: { InfoTooltip: true } },
    })
    expect(wrapper.get('[data-testid="tile-income"]').text()).toBe('1.644,01 €')
    expect(wrapper.get('[data-testid="tile-expenses"]').text()).toBe('-1.778,24 €')
    expect(wrapper.get('[data-testid="tile-balance"]').text()).toBe('-134,23 €')
    expect(wrapper.text()).toContain('50,00 €')
    expect(wrapper.text()).toContain('3,04 %')
  })
})

describe('PeriodSwitcher', () => {
  it('steps back and disables next in the current period', async () => {
    const wrapper = await mountSuspended(PeriodSwitcher, { props: { label: 'November 2026' } })
    expect(wrapper.get('[data-testid="period-next"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="period-prev"]').trigger('click')
    expect(wrapper.get('[data-testid="period-next"]').attributes('disabled')).toBeUndefined()
  })
})

describe('CategoryList', () => {
  it('lists categories with counts and negative totals', async () => {
    const wrapper = await mountSuspended(CategoryList, {
      global: { stubs: { VisSingleContainer: true, VisDonut: true } },
    })
    expect(wrapper.text()).toContain('Ausgaben gesamt (42)')
    expect(wrapper.text()).toContain('-1.778,24 €')
    expect(wrapper.text()).toContain('Wohnen (3)')
    expect(wrapper.text()).toContain('-845,00 €')
  })
})
