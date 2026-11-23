import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import IndexPage from '~/pages/index.vue'

const layout = [
  { widgetKey: 'accounts', position: 0, visible: true },
  { widgetKey: 'networth', position: 1, visible: true },
  { widgetKey: 'allocation', position: 2, visible: false },
  { widgetKey: 'kpis', position: 3, visible: false },
  { widgetKey: 'holdings', position: 4, visible: false },
  { widgetKey: 'review', position: 5, visible: false },
  { widgetKey: 'cashflow', position: 6, visible: false },
  { widgetKey: 'budgets', position: 7, visible: true },
]

registerEndpoint('/api/dashboard/layout', () => layout)
registerEndpoint('/api/accounts/tree', () => ({ groups: [] }))
registerEndpoint('/api/budgets', () => [])
registerEndpoint('/api/overview/net-worth', () => ({
  totalCents: 0,
  gainCents: 0,
  gainPct: null,
  series: [],
}))

describe('overview page', () => {
  it('renders only visible widgets in layout order with empty states', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const order = wrapper
      .findAll('[data-testid$="-card"]')
      .map((element) => element.attributes('data-testid'))
    expect(order).toEqual(['accounts-card', 'networth-card', 'budgets-card'])
    expect(wrapper.text()).toContain('Noch keine Daten')
    expect(wrapper.text()).toContain('Jetzt Budgets erstellen')
    expect(wrapper.text()).not.toContain('NaN')
  })
})
