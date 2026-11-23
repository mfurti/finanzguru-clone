import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import NetWorthChart from '~/components/dashboard/NetWorthChart.vue'

const series = [
  {
    date: '2026-11-21',
    valueCents: 180000,
    investedCents: 150000,
    cashCents: 20000,
    returnPct: '0',
  },
  {
    date: '2026-11-22',
    valueCents: 185645,
    investedCents: 150000,
    cashCents: 23737,
    returnPct: '0.031',
  },
]

registerEndpoint('/api/overview/net-worth', () => ({
  totalCents: 185645,
  gainCents: 14740,
  gainPct: '0.08',
  series,
}))

const stubs = {
  VisXYContainer: true,
  VisArea: true,
  VisLine: true,
  VisAxis: true,
  VisCrosshair: true,
  VisTooltip: true,
}

describe('NetWorthChart', () => {
  it('shows total and gain in de-DE format', async () => {
    const wrapper = await mountSuspended(NetWorthChart, { global: { stubs } })
    expect(wrapper.get('[data-testid="networth-total"]').text()).toBe('1.856,45 €')
    expect(wrapper.text()).toContain('+147,40 €')
    expect(wrapper.text()).toContain('Gesamtvermögen')
    expect(wrapper.text()).toContain('Rendite')
  })
})
