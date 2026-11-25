import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import CardTitle from '~/components/dashboard/CardTitle.vue'
import ReviewBanner from '~/components/dashboard/ReviewBanner.vue'

registerEndpoint('/api/transactions/unreviewed/count', () => ({ count: 1234 }))

describe('dashboard cards (007 T012)', () => {
  it('CardTitle links the title with a chevron and keeps controls right', async () => {
    const wrapper = await mountSuspended(CardTitle, {
      props: { title: 'Holdings', to: '/investments' },
      slots: { default: () => h('span', { 'data-testid': 'control' }, 'x') },
    })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/investments')
    expect(link.text()).toBe('Holdings')
    expect(link.find('.iconify, svg, span[class*="chevron"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="control"]').exists()).toBe(true)
  })

  it('CardTitle without link is plain text', async () => {
    const wrapper = await mountSuspended(CardTitle, { props: { title: 'Kennzahlen' } })
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('h2').text()).toBe('Kennzahlen')
  })

  it('ReviewBanner is one line with count, label and "Alle anzeigen"', async () => {
    const wrapper = await mountSuspended(ReviewBanner)
    expect(wrapper.find('[data-testid="review-count"]').text()).toBe('1.234')
    expect(wrapper.text()).toContain('Ungeprüfte Transaktionen')
    expect(wrapper.text()).toContain('Alle anzeigen')
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.find('a').attributes('href')).toBe('/transactions?review=unreviewed')
  })
})
