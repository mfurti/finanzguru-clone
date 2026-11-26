import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import EmptyState from '~/components/common/EmptyState.vue'
import Money from '~/components/common/Money.vue'
import Percent from '~/components/common/Percent.vue'
import PeriodTabs from '~/components/common/PeriodTabs.vue'

describe('Money', () => {
  it('formats cents in de-DE', async () => {
    const wrapper = await mountSuspended(Money, { props: { cents: 185645 } })
    expect(wrapper.text()).toBe('1.856,45 €')
    expect(wrapper.classes()).not.toContain('text-success')
  })

  it('colors signed gains and losses', async () => {
    const gain = await mountSuspended(Money, { props: { cents: 14740, signed: true } })
    expect(gain.text()).toBe('+147,40 €')
    expect(gain.classes()).toContain('text-success')
    const loss = await mountSuspended(Money, { props: { cents: -13423, signed: true } })
    expect(loss.classes()).toContain('text-error')
  })

  it('renders a dash for missing values', async () => {
    const wrapper = await mountSuspended(Money, { props: { cents: null } })
    expect(wrapper.text()).toBe('–')
  })
})

describe('Percent', () => {
  it('formats decimal-string ratios', async () => {
    const wrapper = await mountSuspended(Percent, { props: { value: '0.1083', signed: true } })
    expect(wrapper.text()).toBe('+10,83 %')
    expect(wrapper.classes()).toContain('text-success')
  })

  it('renders a dash for null instead of NaN', async () => {
    const wrapper = await mountSuspended(Percent, { props: { value: null } })
    expect(wrapper.text()).toBe('–')
  })
})

describe('PeriodTabs', () => {
  it('marks the active period and emits changes', async () => {
    const wrapper = await mountSuspended(PeriodTabs, { props: { modelValue: '1Y' } })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['1W', '1M', 'YTD', '1J', '3J', '5J', 'Gesamt'])
    expect(tabs[3]?.attributes('aria-selected')).toBe('true')
    await tabs[0]?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['1W'])
  })
})

describe('EmptyState', () => {
  it('shows title, description and action', async () => {
    const wrapper = await mountSuspended(EmptyState, {
      props: { title: 'Keine Daten', description: 'Noch nichts da', actionLabel: 'Importieren' },
    })
    expect(wrapper.text()).toContain('Keine Daten')
    expect(wrapper.text()).toContain('Noch nichts da')
    expect(wrapper.text()).toContain('Importieren')
  })
})
