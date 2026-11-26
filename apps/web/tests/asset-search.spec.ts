import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AssetSearch from '~/components/watchlists/AssetSearch.vue'

let available = true
registerEndpoint('/api/market-data/search', () =>
  available
    ? {
        available: true,
        groups: [
          {
            assetClass: 'stock',
            hits: [{ isin: 'US0378331005', wkn: null, name: 'Apple', assetClass: 'stock' }],
            more: true,
          },
          {
            assetClass: 'etf',
            hits: [
              {
                isin: 'IE00BK5BZS07',
                wkn: null,
                name: 'Leverage Shares 3x Apple ETP',
                assetClass: 'etf',
              },
            ],
            more: false,
          },
        ],
      }
    : { available: false, groups: [] },
)

async function search(text: string) {
  const wrapper = await mountSuspended(AssetSearch, { props: { watchlistId: 'w1' } })
  await wrapper.get('input[data-testid="asset-search-input"]').setValue(text)
  await vi.advanceTimersByTimeAsync(350)
  await flushPromises()
  return wrapper
}

describe('AssetSearch (005 T028)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    available = true
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows hits grouped by class with ISIN and an add button', async () => {
    const wrapper = await search('Apple')
    const stock = wrapper.get('[data-testid="asset-search-group-stock"]')
    expect(stock.text()).toContain('Apple')
    expect(stock.text()).toContain('US0378331005')
    expect(wrapper.find('[data-testid="asset-search-group-etf"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="asset-search-add-US0378331005"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="asset-search-more-stock"]').exists()).toBe(true)
  })

  it('explains that search needs the Scalable connection', async () => {
    available = false
    const wrapper = await search('Apple')
    expect(wrapper.get('[data-testid="asset-search-unavailable"]').text()).toContain(
      'Scalable-Verbindung',
    )
  })

  it('waits for at least 2 characters', async () => {
    const wrapper = await search('A')
    expect(wrapper.text()).toContain('Mindestens 2 Zeichen')
    expect(wrapper.find('[data-testid="asset-search-group-stock"]').exists()).toBe(false)
  })
})
