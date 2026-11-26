import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import DonutChart from '~/components/common/DonutChart.vue'

const items = [
  { key: 'a', value: 300, color: '#6366f1', label: 'Wohnen' },
  { key: 'b', value: 100, color: '#10b981', label: 'Freizeit' },
  { key: 'c', value: 0, color: '#f43f5e', label: 'Leer' },
]

function mount(hovered: string | null = null) {
  return mountSuspended(DonutChart, {
    props: { items, hovered },
    slots: {
      center: ({ item }: { item: { label: string } | null }) =>
        h('span', { 'data-testid': 'center' }, item ? item.label : 'Gesamt'),
    },
  })
}

describe('DonutChart', () => {
  it('draws one slice per item with a value', async () => {
    const wrapper = await mount()
    expect(wrapper.findAll('[data-testid="donut-slice"]')).toHaveLength(2)
    expect(wrapper.get('svg').attributes('aria-label')).toBe('Wohnen: 75 %, Freizeit: 25 %')
    expect(wrapper.get('[data-testid="center"]').text()).toBe('Gesamt')
  })

  it('reports the hovered slice and shows it in the center', async () => {
    const wrapper = await mount()
    await wrapper.findAll('[data-testid="donut-slice"]')[1]!.trigger('mouseenter')
    expect(wrapper.emitted('update:hovered')![0]).toEqual(['b'])
    await wrapper.setProps({ hovered: 'b' })
    expect(wrapper.get('[data-testid="center"]').text()).toBe('Freizeit')
    expect(wrapper.findAll('.donut-halo.is-active')).toHaveLength(1)
  })

  it('emits select on click', async () => {
    const wrapper = await mount()
    await wrapper.findAll('[data-testid="donut-slice"]')[0]!.trigger('click')
    expect(wrapper.emitted('select')![0]).toEqual(['a'])
  })
})
