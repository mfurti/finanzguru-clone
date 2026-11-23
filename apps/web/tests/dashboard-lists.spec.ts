import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AccountsCard from '~/components/dashboard/AccountsCard.vue'
import HoldingsCard from '~/components/dashboard/HoldingsCard.vue'
import ReviewBanner from '~/components/dashboard/ReviewBanner.vue'

registerEndpoint('/api/overview/holdings/top-flop', () => ({
  top: [
    {
      instrumentId: 'i1',
      name: 'MSCI World ETF',
      priceCents: 12214,
      changePct: '0.0072',
      changeCents: 88,
    },
  ],
  flop: [],
}))
registerEndpoint('/api/accounts/tree', () => ({
  groups: [
    {
      type: 'depots',
      totalCents: 161908,
      items: [
        {
          id: 'd1',
          name: 'Demo Depot',
          institution: 'Demo Broker',
          logoKey: null,
          valueCents: 161908,
          children: [
            {
              id: 'r1',
              name: 'Referenzkonto',
              institution: 'Demo Broker',
              logoKey: null,
              valueCents: 0,
            },
          ],
        },
      ],
    },
    {
      type: 'accounts',
      totalCents: 23737,
      items: [
        { id: 'g1', name: 'Girokonto', institution: 'Demo Bank', logoKey: null, valueCents: 23737 },
      ],
    },
  ],
}))
registerEndpoint('/api/transactions/unreviewed/count', () => ({ count: 1974 }))

describe('HoldingsCard', () => {
  it('shows top holdings and a dash for an empty flop list', async () => {
    const wrapper = await mountSuspended(HoldingsCard)
    expect(wrapper.text()).toContain('MSCI World ETF')
    expect(wrapper.text()).toContain('+0,72 %')
    expect(wrapper.text()).toContain('+0,88 €')
    expect(wrapper.text()).toContain('Flop')
  })
})

describe('AccountsCard', () => {
  it('groups depots and accounts and collapses a group', async () => {
    const wrapper = await mountSuspended(AccountsCard)
    expect(wrapper.text()).toContain('Depots')
    expect(wrapper.text()).toContain('1.619,08 €')
    expect(wrapper.text()).toContain('Referenzkonto')
    const toggle = wrapper.findAll('button[aria-expanded]')[0]!
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
  })
})

describe('ReviewBanner', () => {
  it('shows the formatted count and a link', async () => {
    const wrapper = await mountSuspended(ReviewBanner)
    expect(wrapper.text()).toContain('1.974')
    expect(wrapper.text()).toContain('Ungeprüfte Transaktionen')
    expect(wrapper.find('a[href="/budget/review"]').exists()).toBe(true)
  })
})
