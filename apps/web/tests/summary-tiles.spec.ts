import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import type { CashflowSummary } from '@finance/shared'
import SummaryTiles from '~/components/budget/SummaryTiles.vue'

const summary = {
  period: { from: '2026-11-01', to: '2026-11-30', label: 'November 2026' },
  incomeCents: 100000,
  expenseCents: 25000,
  balanceCents: 75000,
  savedCents: 5000,
  savingsRate: '0.05',
  bars: [],
} as unknown as CashflowSummary

// UTooltip needs UApp's TooltipProvider, which a single-component mount lacks.
const stubs = { InfoTooltip: true }

describe('SummaryTiles (010 T017)', () => {
  it('frames both boxes with a visible border on the page surface', async () => {
    const wrapper = await mountSuspended(SummaryTiles, { props: { summary }, global: { stubs } })
    const boxes = wrapper.findAll('[data-testid="summary-tiles"] > div')
    expect(boxes).toHaveLength(2)
    for (const box of boxes)
      expect(box.classes()).toEqual(expect.arrayContaining(['border', 'border-accented']))
  })

  it('shows Gespart and Sparquote with the label left and the value right', async () => {
    const wrapper = await mountSuspended(SummaryTiles, { props: { summary }, global: { stubs } })
    const rows = wrapper.findAll('[data-testid="saved-box"] > div')
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row.classes()).toContain('justify-between')
    expect(wrapper.get('[data-testid="tile-saved"]').text()).toContain('50,00')
    expect(wrapper.get('[data-testid="tile-savings-rate"]').text()).toContain('5')
  })

  it('puts all five figures in one row from 1280 px on the Analyse page', async () => {
    const wide = await mountSuspended(SummaryTiles, {
      props: { summary, wide: true },
      global: { stubs },
    })
    expect(wide.get('[data-testid="summary-tiles"]').classes()).toContain('xl:grid-cols-[3fr_2fr]')
    const narrow = await mountSuspended(SummaryTiles, { props: { summary }, global: { stubs } })
    expect(narrow.get('[data-testid="summary-tiles"]').classes()).not.toContain(
      'xl:grid-cols-[3fr_2fr]',
    )
  })
})
