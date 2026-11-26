import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { SankeyResponse } from '@finance/shared'
import { describe, expect, it } from 'vitest'
import SankeyChart from '~/components/budget/SankeyChart.vue'

registerEndpoint('/api/categories', () => [])

const graph = {
  nodes: [
    { id: 'income', label: 'Einnahmen', kind: 'income' },
    { id: 'main:leben', label: 'Lebenshaltung', kind: 'main' },
    { id: 'main:wohnen', label: 'Wohnen', kind: 'main' },
    { id: 'sub:miete', label: 'Miete', kind: 'sub' },
    { id: 'sub:essen', label: 'Lebensmittel', kind: 'sub' },
  ],
  links: [
    { source: 'income', target: 'main:leben', valueCents: 40000 },
    { source: 'income', target: 'main:wohnen', valueCents: 90000 },
    { source: 'main:wohnen', target: 'sub:miete', valueCents: 90000 },
    { source: 'main:leben', target: 'sub:essen', valueCents: 40000 },
  ],
} as unknown as SankeyResponse

// The ECharts drawing needs a real browser; the block list is what this test covers.
const stubs = { ClientOnly: true }
const mount = (selected: string | null = null) =>
  mountSuspended(SankeyChart, {
    props: { graph, incomeCents: 130000, unit: 'eur' as const, selected },
    global: { stubs },
  })

describe('SankeyChart block list (011 T004)', () => {
  it('lists the category blocks in chart order with their amounts', async () => {
    const wrapper = await mount()
    const buttons = wrapper.findAll('[data-testid="sankey-node"]')
    expect(buttons.map((button) => button.attributes('data-node'))).toEqual([
      'main:wohnen',
      'main:leben',
      'sub:miete',
      'sub:essen',
    ])
    expect(buttons[0]!.text()).toBe('Wohnen: 900,00 €')
  })

  it('selects a block and clears it when the selected one is chosen again', async () => {
    const wrapper = await mount()
    await wrapper.get('[data-node="main:wohnen"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['wohnen']])

    const selected = await mount('wohnen')
    expect(selected.get('[data-node="main:wohnen"]').attributes('aria-pressed')).toBe('true')
    await selected.get('[data-node="main:wohnen"]').trigger('click')
    expect(selected.emitted('select')).toEqual([[null]])
  })
})
