import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ClassificationForm from '~/components/analysis/ClassificationForm.vue'
import ReturnHeatmap from '~/components/analysis/ReturnHeatmap.vue'
import YearlyTable from '~/components/analysis/YearlyTable.vue'

describe('ReturnHeatmap', () => {
  it('shows monthly returns per year and the yearly total', async () => {
    const wrapper = await mountSuspended(ReturnHeatmap, {
      props: {
        months: [
          { year: 2025, month: 1, twror: '0.02' },
          { year: 2025, month: 2, twror: '-0.01' },
        ],
        years: [
          {
            year: 2025,
            twror: '0.0098',
            xirr: null,
            inflation: '0.02',
            realReturn: null,
            ytd: false,
          },
        ],
      },
    })
    const text = wrapper.text()
    expect(text).toContain('+2,00 %')
    expect(text).toContain('-1,00 %')
    expect(wrapper.get('[data-testid="heatmap-total-2025"]').text()).toBe('+0,98 %')
    // Months without data show a dash.
    expect(text).toContain('–')
  })
})

describe('YearlyTable', () => {
  it('marks the current year as YTD and shows real returns', async () => {
    const wrapper = await mountSuspended(YearlyTable, {
      props: {
        years: [
          {
            year: 2026,
            twror: '0.05',
            xirr: '0.06',
            inflation: '0.02',
            realReturn: '0.0392',
            ytd: true,
          },
        ],
      },
    })
    const row = wrapper.get('[data-testid="yearly-2026"]').text()
    expect(row).toContain('YTD')
    expect(row).toContain('+6,00 %')
    expect(row).toContain('+3,92 %')
  })
})

describe('ClassificationForm', () => {
  it('shows the sum per dimension and prefills new rows with the remainder', async () => {
    registerEndpoint('/api/instruments/i1/classification', () => ({
      fundType: 'equity',
      isBenchmark: false,
      weights: {
        region: [
          { key: 'north_america', weight: '0.7' },
          { key: 'europe', weight: '0.2' },
        ],
        sector: [],
        currency: [],
      },
    }))
    const wrapper = await mountSuspended(ClassificationForm, {
      props: { instrumentId: 'i1', isFund: true },
    })
    expect(wrapper.get('[data-testid="sum-region"]').text()).toContain('Summe 90 %')
    expect(
      wrapper.get('[data-testid="classification-save"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.get('[data-testid="weight-add-region"]').trigger('click')
    await nextTick()
    // The new row is prefilled with the remaining 10 %.
    expect(wrapper.get('[data-testid="sum-region"]').text()).toContain('Summe 100 %')
  })
})
