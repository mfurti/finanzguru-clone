import { describe, expect, it } from 'vitest'
import { budgetMonthOf } from '~/composables/useBudgetPeriod'
import { monthAxis } from '~/utils/month-axis'

describe('budget month start in the web (014 T011)', () => {
  it('maps a date to its budget month', () => {
    expect(budgetMonthOf('2026-11-24', 25)).toBe('2026-11-01')
    expect(budgetMonthOf('2026-11-25', 25)).toBe('2026-12-01')
    expect(budgetMonthOf('2026-12-31', 25)).toBe('2027-01-01')
    expect(budgetMonthOf('2026-11-30', 1)).toBe('2026-11-01')
  })

  it('labels a shifted bar by the month it ends in', () => {
    const axis = monthAxis([{ from: '2026-10-25', to: '2026-11-24' }])
    expect(axis.labels[0]).toMatch(/^Nov/)
  })
})

describe('period switcher with a budget month start (014 T011)', () => {
  it('start 25: November shows 25.10. – 24.11., Q4 25.09. – 24.12.', async () => {
    const { mountSuspended } = await import('@nuxt/test-utils/runtime')
    const { DEFAULT_OWNER_SETTINGS } = await import('@finance/shared')
    const PeriodSwitcher = (await import('~/components/budget/PeriodSwitcher.vue')).default
    const { useBudgetPeriod } = await import('~/composables/useBudgetPeriod')
    useState('owner-settings').value = { ...DEFAULT_OWNER_SETTINGS, budgetMonthStart: 25 }
    const wrapper = await mountSuspended(PeriodSwitcher, { props: { label: 'November 2026' } })
    const period = useBudgetPeriod()
    period.granularity.value = 'month'
    period.setAnchor('2026-11-10')
    await nextTick()
    expect(wrapper.find('[data-testid="period-range"]').text()).toBe('25.10. – 24.11.')
    period.granularity.value = 'quarter'
    await nextTick()
    expect(wrapper.find('[data-testid="period-range"]').text()).toBe('25.09. – 24.12.')
    period.granularity.value = 'month'
    useState('owner-settings').value = { ...DEFAULT_OWNER_SETTINGS }
  })
})
