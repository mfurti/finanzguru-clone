import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PeriodSwitcher from '~/components/budget/PeriodSwitcher.vue'
import { useBudgetPeriod } from '~/composables/useBudgetPeriod'

describe('budget period picker (003 US3)', () => {
  it('disables "Aktueller Monat" while the current month is shown', async () => {
    const wrapper = await mountSuspended(PeriodSwitcher, { props: { label: 'November 2026' } })
    const period = useBudgetPeriod()
    period.reset()
    await nextTick()
    const current = wrapper.find('[data-testid="period-current"]')
    expect(current.text()).toBe('Aktueller Monat')
    expect(current.attributes('disabled')).toBeDefined()
    period.previous()
    await nextTick()
    expect(wrapper.find('[data-testid="period-current"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the date range of the selected month and quarter', async () => {
    const wrapper = await mountSuspended(PeriodSwitcher, { props: { label: 'September 2026' } })
    const period = useBudgetPeriod()
    period.granularity.value = 'month'
    period.setAnchor('2026-09-15')
    await nextTick()
    expect(wrapper.find('[data-testid="period-range"]').text()).toBe('01.09. – 30.09.')
    period.granularity.value = 'quarter'
    await nextTick()
    expect(wrapper.find('[data-testid="period-range"]').text()).toBe('01.07. – 30.09.')
    period.granularity.value = 'month'
  })
})
