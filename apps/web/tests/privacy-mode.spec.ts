import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import Money from '~/components/common/Money.vue'
import Percent from '~/components/common/Percent.vue'
import { compactEur } from '~/utils/compact-eur'
import { formatEur, formatEurSigned, privacyOn, wholeEuros } from '~/utils/privacy'

describe('privacy mode (014 T009)', () => {
  afterEach(() => {
    privacyOn.value = false
    wholeEuros.value = false
  })

  it('rounds to whole euros for display only (014 T010)', () => {
    wholeEuros.value = true
    expect(formatEur(123456)).toBe('1.235 €')
    expect(formatEurSigned(-4949)).toBe('-49 €')
    wholeEuros.value = false
    expect(formatEur(123456)).toBe('1.234,56 €')
  })

  it('masks amounts, percentages and chart labels while on', async () => {
    const money = await mountSuspended(Money, { props: { cents: 123456 } })
    const percent = await mountSuspended(Percent, { props: { value: 0.0815 } })
    expect(money.text()).toBe('1.234,56 €')
    expect(percent.text()).toBe('8,15 %')

    privacyOn.value = true
    await money.vm.$nextTick()
    expect(money.text()).toBe('•••• €')
    expect(percent.text()).toBe('•• %')
    expect(formatEur(500)).toBe('•••• €')
    expect(compactEur(500_000)).toBe('•••• €')
  })
})
