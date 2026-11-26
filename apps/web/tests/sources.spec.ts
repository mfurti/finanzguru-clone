import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import SourcesPage from '~/pages/settings/sources.vue'

registerEndpoint('/api/sources', () => [
  {
    id: 'csv',
    kind: 'csv',
    status: 'active',
    displayName: 'CSV-Import',
    lastSyncAt: null,
    lastError: null,
  },
  {
    id: 'sparkasse_fints',
    kind: 'sparkasse_fints',
    status: 'planned',
    displayName: 'Sparkasse (Live-Abfrage)',
    lastSyncAt: null,
    lastError: null,
  },
])
registerEndpoint('/api/accounts', () => [])

describe('data sources page (US7)', () => {
  it('shows the Sparkasse live query as planned', async () => {
    const wrapper = await mountSuspended(SourcesPage)
    expect(wrapper.text()).toContain('Sparkasse (Live-Abfrage)')
    expect(wrapper.get('[data-testid="source-status-sparkasse_fints"]').text()).toBe('geplant')
    expect(wrapper.get('[data-testid="source-status-csv"]').text()).toBe('aktiv')
  })
})
