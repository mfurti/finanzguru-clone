import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import CategoryDonut from '~/components/budget/CategoryDonut.vue'
import DonutChart from '~/components/common/DonutChart.vue'

const items = [
  { categoryId: 'c1', name: 'Wohnen', totalCents: 70000, count: 1 },
  { categoryId: 'c2', name: 'Lebensmittel', totalCents: 30000, count: 4 },
] as never

async function mount(kind: 'expense' | 'income') {
  return mountSuspended(CategoryDonut, {
    props: { items, totalCents: 100000, sign: -1, colors: () => '#888', kind },
  })
}

describe('Budget › Analyse (007 T015)', () => {
  it('labels the donut centre "Gesamtausgaben" or "Gesamteinnahmen"', async () => {
    expect((await mount('expense')).find('[data-testid="donut-center-label"]').text()).toBe(
      'Gesamtausgaben',
    )
    expect((await mount('income')).find('[data-testid="donut-center-label"]').text()).toBe(
      'Gesamteinnahmen',
    )
  })

  it('draws the category donut in the dashboard look (011 supersedes the no-gap donut)', async () => {
    const wrapper = await mount('expense')
    expect(wrapper.findComponent(DonutChart).props()).toMatchObject({ size: 176, thickness: 22 })
  })
})
