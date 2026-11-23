import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AssetClassTable from '~/components/investments/AssetClassTable.vue'
import PositionsTable from '~/components/investments/PositionsTable.vue'

const position = {
  instrumentId: 'i1',
  name: 'iShares Core MSCI World UCITS ETF (Acc)',
  assetClass: 'etf',
  wkn: 'A0RPWH',
  isin: 'IE00B4L5Y983',
  priceCents: 12214,
  dayChangePct: '0.0072',
  quantity: '13.26',
  valueCents: 161908,
  entryValueCents: 146699,
  avgPrice: '110.63',
  gainCents: 15209,
  gainPct: '0.1037',
  allocationPct: '1',
  dividendsCents: 0,
}

registerEndpoint('/api/investments/positions', (event) => {
  const url = new URL(event.node.req.url ?? '', 'http://x')
  if (url.searchParams.get('status') === 'sold') {
    return [
      { ...position, instrumentId: 'i2', name: 'SAP SE', assetClass: 'stock', realizedCents: 4200 },
    ]
  }
  return [position]
})
registerEndpoint('/api/investments/asset-classes', () => [
  { assetClass: 'etf', valueCents: 161908, pct: '1', count: 1 },
])

describe('PositionsTable', () => {
  it('renders positions, asset chips, export link and sold positions', async () => {
    const wrapper = await mountSuspended(PositionsTable)
    const text = wrapper.text()
    expect(text).toContain('iShares Core MSCI World')
    expect(text).toContain('1.619,08 €')
    expect(text).toContain('+152,09 €')
    expect(wrapper.find('[data-testid="chip-etf"]').exists()).toBe(true)
    const href = wrapper.get('[data-testid="positions-export"]').attributes('href')
    expect(href).toContain('/api/investments/positions.csv?columns=name%2CassetClass')
    expect(wrapper.text()).toContain('Verkaufte Investments (1)')
  })
})

describe('AssetClassTable', () => {
  it('lists asset classes with share and value', async () => {
    const wrapper = await mountSuspended(AssetClassTable)
    expect(wrapper.text()).toContain('ETF')
    expect(wrapper.text()).toContain('100,00 %')
    expect(wrapper.text()).toContain('1.619,08 €')
  })
})
