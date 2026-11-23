import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AllocationCard from '~/components/dashboard/AllocationCard.vue'
import KpiCard from '~/components/dashboard/KpiCard.vue'

registerEndpoint('/api/overview/allocation', () => ({
  totalCents: 185645,
  slices: [
    { key: 'etf', label: 'ETF', count: 1, valueCents: 161908, pct: '0.8721' },
    { key: 'cash', label: 'Cash', count: 2, valueCents: 23737, pct: '0.1279' },
  ],
}))

registerEndpoint('/api/overview/kpis', () => ({
  investedCents: 146699,
  priceGain: { cents: 12200, pct: '0.0832' },
  realized: { grossCents: 9976, netCents: 9481, pct: '0.068' },
  otherGainsCents: 0,
  dividends: { grossCents: 0, netCents: 0 },
  interest: { grossCents: 25, netCents: 25 },
  taxesFeesCents: -495,
  totalReturnCents: 21706,
  twror: '0.1083',
  irr: '0.0623',
  inflation: '0.0253',
  realReturn: null,
}))

const stubs = { VisSingleContainer: true, VisDonut: true }

describe('AllocationCard', () => {
  it('lists slices in € and switches to %', async () => {
    const wrapper = await mountSuspended(AllocationCard, { global: { stubs } })
    expect(wrapper.text()).toContain('ETF')
    expect(wrapper.text()).toContain('1.619,08 €')
    const pct = wrapper.findAll('button').find((button) => button.text() === '%')!
    await pct.trigger('click')
    expect(wrapper.text()).toContain('87,21 %')
  })
})

describe('KpiCard', () => {
  it('shows the KPI rows with signed values and rates', async () => {
    // UTooltip needs UApp's TooltipProvider, which a single-component mount lacks.
    const wrapper = await mountSuspended(KpiCard, { global: { stubs: { InfoTooltip: true } } })
    const text = wrapper.text()
    expect(text).toContain('Investiertes Kapital')
    expect(text).toContain('1.466,99 €')
    expect(text).toContain('+122,00 €')
    expect(text).toContain('-4,95 €')
    expect(text).toContain('Gesamtertrag')
    expect(text).toContain('+10,83 %')
    expect(text).toContain('2,53 %')
    // realReturn is null: rendered as a dash, never NaN.
    expect(text).not.toContain('NaN')
  })
})
