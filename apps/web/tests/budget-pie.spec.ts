import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import CategoryDonut from '~/components/budget/CategoryDonut.vue'
import CategoryList from '~/components/budget/CategoryList.vue'

const items = [
  {
    categoryId: 'wohnen',
    name: 'Wohnen',
    color: 'blue',
    count: 2,
    totalCents: 90000,
    pct: '0.5',
    children: [],
  },
  {
    categoryId: 'leben',
    name: 'Lebenshaltung',
    color: 'green',
    count: 5,
    totalCents: 60000,
    pct: '0.333333',
    children: [],
  },
  {
    categoryId: 'freizeit',
    name: 'Freizeit',
    color: 'red',
    count: 1,
    totalCents: 30000,
    pct: '0.166667',
    children: [],
  },
]
registerEndpoint('/api/cashflow/categories', () => ({ totalCents: 180000, count: 8, items }))
registerEndpoint('/api/transactions', () => ({ items: [], total: 0 }))

describe('CategoryDonut (US7)', () => {
  it('shows the total in the center', async () => {
    const wrapper = await mountSuspended(CategoryDonut, {
      props: { items, totalCents: 180000, sign: -1, colors: () => '#000' },
    })
    expect(wrapper.text()).toContain('-1.800,00 €')
    expect(wrapper.text()).toContain('Gesamt')
  })

  it('shows the empty state without data', async () => {
    const wrapper = await mountSuspended(CategoryDonut, {
      props: { items: [], totalCents: 0, sign: -1, colors: () => '#000' },
    })
    expect(wrapper.text()).toContain('Keine Buchungen in diesem Zeitraum')
  })
})

describe('CategoryList with pie chart (US7)', () => {
  it('switches between € and %, and the shares add up to 100 %', async () => {
    const wrapper = await mountSuspended(CategoryList)
    expect(wrapper.get('[data-testid="category-Wohnen"]').text()).toContain('-900,00 €')

    await wrapper.get('[data-testid="category-unit-pct"]').trigger('click')
    const shares = items.map((item) => {
      const text = wrapper.get(`[data-testid="category-${item.name}"]`).text()
      const match = /(\d+,\d+) %/.exec(text)
      return Number(match![1]!.replace(',', '.'))
    })
    expect(shares).toEqual([50, 33.33, 16.67])
    expect(Math.abs(shares.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(0.1)
  })

  it('highlights the row of the hovered category', async () => {
    const wrapper = await mountSuspended(CategoryList)
    const row = wrapper.get('[data-testid="category-Lebenshaltung"]')
    await row.trigger('mouseenter')
    expect(row.attributes('data-hovered')).toBe('true')
    await row.trigger('mouseleave')
    expect(row.attributes('data-hovered')).toBeUndefined()
  })
})
