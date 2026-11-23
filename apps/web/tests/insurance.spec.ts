import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ContractList from '~/components/insurance/ContractList.vue'

describe('ContractList', () => {
  it('shows type, provider, premium per interval and yearly cost', async () => {
    const wrapper = await mountSuspended(ContractList, {
      props: {
        contracts: [
          {
            id: 'c1',
            type: 'term_life',
            provider: 'Demo Versicherung AG',
            contractNumber: 'RLV-1',
            premiumCents: 2362,
            interval: 'monthly',
            startDate: '2024-01-01',
            endDate: null,
            notes: null,
            linkedCategoryId: null,
            yearlyCostCents: 28344,
          },
        ],
      },
    })
    const text = wrapper.text()
    expect(text).toContain('Risiko-Lebensversicherung · Demo Versicherung AG')
    expect(text).toContain('23,62 € / Monat')
    expect(wrapper.get('[data-testid="yearly-cost"]').text()).toContain('283,44 €')
  })
})
