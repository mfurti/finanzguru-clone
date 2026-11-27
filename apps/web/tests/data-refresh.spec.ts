import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import DataRefresh from '~/components/dashboard/DataRefresh.vue'

let state = {
  oldestSuccessAt: '2026-11-25T08:30:00Z',
  outdated: true,
  sources: [
    {
      source: 'enable_banking',
      name: 'Sparkasse',
      lastSuccessAt: '2026-11-25T08:30:00Z',
      lastError: null,
    },
    { source: 'quotes', name: 'Kurse', lastSuccessAt: '2026-11-27T09:00:00Z', lastError: null },
  ],
  newestBookingDate: '2026-11-26',
}
const refreshAll = vi.fn(() => [
  {
    source: 'enable_banking',
    name: 'Sparkasse',
    ok: true,
    at: '2026-11-27T10:00:00Z',
    error: null,
  },
])
registerEndpoint('/api/sources/state', () => state)
registerEndpoint('/api/sources/refresh-all', { method: 'POST', handler: refreshAll })

const stubs = { UTooltip: { template: '<span><slot /></span>' } }

describe('DataRefresh (013 T008)', () => {
  it('shows the oldest fetch as Stand, marked when outdated, and refreshes all sources', async () => {
    const wrapper = await mountSuspended(DataRefresh, { global: { stubs } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Stand: 25.11.2026'))
    expect(wrapper.get('[data-testid="data-state"]').attributes('data-outdated')).toBe('true')
    await wrapper.get('[data-testid="refresh-all"]').trigger('click')
    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalledTimes(1))
  })

  it('without a connected source the button is disabled and the newest booking is shown', async () => {
    state = { ...state, sources: [], oldestSuccessAt: null, outdated: false }
    const wrapper = await mountSuspended(DataRefresh, { global: { stubs } })
    await refreshNuxtData('data-state')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Letzte Buchung: 26.11.2026'))
    expect(wrapper.get('[data-testid="refresh-all"]').attributes('disabled')).toBeDefined()
  })
})
