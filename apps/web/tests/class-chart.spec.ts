import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PerformanceChart from '~/components/investments/PerformanceChart.vue'

registerEndpoint('/api/investments/performance', () => ({
  valueCents: 330000,
  gainCents: 12000,
  gainPct: '0.04',
  series: [
    { date: '2026-11-23', valueCents: 320000, investedCents: 300000 },
    { date: '2026-11-24', valueCents: 330000, investedCents: 300000 },
  ],
}))
registerEndpoint('/api/investments/performance/classes', () => ({
  classes: ['etf', 'stock'],
  series: [
    {
      date: '2026-11-23',
      total: { valueCents: 320000, twrorPct: '0.000000' },
      byClass: {
        etf: { valueCents: 220000, twrorPct: '0.000000' },
        stock: { valueCents: 100000, twrorPct: '0.000000' },
      },
    },
    {
      date: '2026-11-24',
      total: { valueCents: 330000, twrorPct: '0.031250' },
      byClass: {
        etf: { valueCents: 230000, twrorPct: '0.045455' },
        stock: { valueCents: 100000, twrorPct: '0.000000' },
      },
    },
  ],
}))
registerEndpoint('/api/benchmarks', () => [])
registerEndpoint('/api/settings/charts', () => ({}))

const stubs = {
  VisXYContainer: true,
  VisLine: true,
  VisAxis: true,
  VisCrosshair: true,
  VisTooltip: true,
}

describe('PerformanceChart class chips (005 T019)', () => {
  it('adds one line per selected class and keeps the headline on "Alle"', async () => {
    const wrapper = await mountSuspended(PerformanceChart, { global: { stubs } })
    const total = wrapper.get('[data-testid="investments-total"]').text()
    expect(total).toBe('3.300,00 €')
    expect(wrapper.get('[data-testid="class-chip-fund"]').attributes('disabled')).toBeDefined()
    const lines = () => wrapper.findAll('[data-testid^="class-legend-"]').length
    const before = lines()
    expect(before).toBe(0)
    await wrapper.get('[data-testid="class-chip-etf"]').trigger('click')
    await wrapper.get('[data-testid="class-chip-stock"]').trigger('click')
    expect(lines()).toBe(2)
    expect(wrapper.get('[data-testid="class-legend"]').text()).toContain('ETF')
    expect(wrapper.get('[data-testid="class-chip-etf"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="investments-total"]').text()).toBe(total)
    await wrapper.get('[data-testid="class-chip-all"]').trigger('click')
    expect(lines()).toBe(before)
    expect(wrapper.text()).not.toContain('NaN')
  })
})
