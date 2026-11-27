import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import DemoDataCard from '~/components/sources/DemoDataCard.vue'

let present = true
const removed = vi.fn(() => {
  present = false
  return { institutions: 2, accounts: 3, transactions: 120, instruments: 4, prices: 900 }
})
registerEndpoint('/api/demo', {
  method: 'GET',
  handler: () => ({ present }),
})
registerEndpoint('/api/demo', { method: 'DELETE', handler: removed })

// The confirm dialog renders inline in the test.
const stubs = {
  UModal: {
    props: ['open'],
    template: '<div v-if="open"><slot name="body" /><slot name="footer" /></div>',
  },
}

describe('DemoDataCard (013 T003)', () => {
  it('removes the demo data only after confirming', async () => {
    const wrapper = await mountSuspended(DemoDataCard, { global: { stubs } })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="demo-data-card"]').exists()).toBe(true),
    )
    await wrapper.get('[data-testid="demo-remove"]').trigger('click')
    expect(removed).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="demo-remove-confirm"]').trigger('click')
    await vi.waitFor(() => expect(removed).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="demo-data-card"]').exists()).toBe(false),
    )
  })
})
