import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CategoriesPage from '~/pages/settings/categories.vue'

registerEndpoint('/api/categories', () => [
  {
    id: 'home',
    parentId: null,
    name: 'Wohnen',
    kind: 'expense',
    color: 'blue',
    icon: 'house',
    isDefault: true,
    children: [
      {
        id: 'rent',
        parentId: 'home',
        name: 'Miete',
        kind: 'expense',
        color: 'blue',
        icon: 'house',
        isDefault: true,
        children: [],
      },
    ],
  },
])
const rules = [
  {
    id: 'r1',
    priority: 1,
    matchField: 'counterparty',
    operator: 'contains',
    pattern: 'vermieter',
    amountSign: 'negative',
    categoryId: 'rent',
    enabled: true,
  },
  {
    id: 'r2',
    priority: 2,
    matchField: 'purpose',
    operator: 'contains',
    pattern: 'miete',
    amountSign: null,
    categoryId: 'rent',
    enabled: false,
  },
]
registerEndpoint('/api/rules', () => rules)

const { calls } = vi.hoisted(() => ({ calls: [] as [string, Record<string, unknown>][] }))
mockNuxtImport('apiFetch', () => async (url: string, options: Record<string, unknown> = {}) => {
  calls.push([url, options])
  if (url === '/api/rules/reorder') return [rules[1], rules[0]]
  if (url === '/api/rules/preview') return { matches: 0, wouldChange: 0 }
  return {}
})

describe('rules page (006 T015)', () => {
  it('lists rules with condition, sign, category and state', async () => {
    const wrapper = await mountSuspended(CategoriesPage)
    const rows = wrapper.findAll('[data-testid="rule-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Gegenpartei enthält „vermieter“')
    expect(rows[0]!.text()).toContain('Nur Ausgaben')
    expect(rows[0]!.text()).toContain('Miete')
    expect(rows[1]!.classes()).toContain('opacity-60')
    expect(rows[0]!.get('[data-testid="rule-up"]').attributes('disabled')).toBeDefined()
  })

  it('moves a rule down by sending the full new order', async () => {
    const wrapper = await mountSuspended(CategoriesPage)
    await wrapper.findAll('[data-testid="rule-down"]')[0]!.trigger('click')
    await flushPromises()
    const reorder = calls.find(([url]) => url === '/api/rules/reorder')!
    expect(reorder[1]).toMatchObject({ method: 'POST', body: { ids: ['r2', 'r1'] } })
    expect(wrapper.findAll('[data-testid="rule-row"]')[0]!.text()).toContain('miete')
  })

  it('has no stale hint about the old review page', async () => {
    const wrapper = await mountSuspended(CategoriesPage)
    expect(wrapper.text()).not.toContain('beim Prüfen')
    expect(wrapper.find('[data-testid="rule-new"]').exists()).toBe(true)
  })
})
