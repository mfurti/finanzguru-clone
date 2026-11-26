import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RuleSuggestions from '~/components/transactions/RuleSuggestions.vue'

registerEndpoint('/api/categories', () => [
  {
    id: 'phone-main',
    parentId: null,
    name: 'Kommunikation',
    kind: 'expense',
    color: 'blue',
    icon: 'phone',
    isDefault: true,
    children: [
      {
        id: 'phone',
        parentId: 'phone-main',
        name: 'Handy',
        kind: 'expense',
        color: 'blue',
        icon: 'phone',
        isDefault: true,
        children: [],
      },
    ],
  },
])
registerEndpoint('/api/rules/suggestions', () => [
  { id: 's1', counterparty: 'Mobilfunk Test AG', categoryId: 'phone', count: 2, affected: 4 },
])

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }))
mockNuxtImport('apiFetch', () => async (url: string) => {
  calls.push(url)
  return { ruleId: 'r1', applied: 4 }
})

describe('RuleSuggestions (006 T012)', () => {
  it('shows recipient, category and affected bookings with accept and decline', async () => {
    const wrapper = await mountSuspended(RuleSuggestions)
    await flushPromises()
    const row = wrapper.get('[data-testid="rule-suggestion"]')
    expect(row.text()).toContain('Mobilfunk Test AG')
    expect(row.text()).toContain('Handy')
    expect(row.text()).toContain('4 Buchungen')
    await row.get('[data-testid="rule-suggestion-accept"]').trigger('click')
    await flushPromises()
    expect(calls).toContain('/api/rules/suggestions/s1/accept')
    expect(wrapper.emitted('changed')).toHaveLength(1)
    await row.get('[data-testid="rule-suggestion-decline"]').trigger('click')
    await flushPromises()
    expect(calls).toContain('/api/rules/suggestions/s1/decline')
  })
})
