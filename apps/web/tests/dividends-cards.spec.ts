import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { DividendSummary as Summary } from '@finance/shared'
import { describe, expect, it } from 'vitest'
import DividendSplit from '~/components/dividends/DividendSplit.vue'
import DividendSummary from '~/components/dividends/DividendSummary.vue'

const summary = {
  last12Cents: 2190,
  avgPerMonthCents: 182,
  ytdCents: 1500,
  yieldYtd: '0.002',
  cagr: '0.8',
  years: [],
  bySecurity: [{ instrumentId: 'i1', name: 'ETF Welt', cents: 2190, pct: '1' }],
  byRegion: [],
  bySector: [],
  byCurrency: [
    { key: 'USD', label: 'US-Dollar', cents: 1500, pct: '0.685' },
    { key: 'EUR', label: 'Euro', cents: 690, pct: '0.315' },
  ],
  portfolioValueCents: 166597,
} as unknown as Summary

describe('Dividenden like the reference (012 T010)', () => {
  it('shows the cards Investments, Dividendenerträge and Dividendenrendite', async () => {
    const wrapper = await mountSuspended(DividendSummary, { props: { summary } })
    const year = new Date().getFullYear()
    expect(wrapper.get('[data-testid="dividends-card-investments"]').text()).toContain(
      'Portfoliowert',
    )
    expect(wrapper.get('[data-testid="dividends-portfolio"]').text()).toContain('1.665,97')
    expect(wrapper.get('[data-testid="dividends-card-investments"]').text()).toContain(
      `Dividenden ${year}`,
    )
    expect(wrapper.get('[data-testid="dividends-card-income"]').text()).toContain(
      'Letzte 12 Monate',
    )
    expect(wrapper.get('[data-testid="dividends-card-yield"]').text()).toContain(`${year} YTD`)
  })

  it('splits by currency in the Aufteilung', async () => {
    const wrapper = await mountSuspended(DividendSplit, { props: { summary } })
    await wrapper.get('[data-testid="dividend-split-currency"]').trigger('click')
    expect(wrapper.text()).toContain('US-Dollar')
    expect(wrapper.text()).toContain('Euro')
  })
})
