import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import RestoreCard from '~/components/settings/RestoreCard.vue'

let pending: { appVersion: string; createdAt: string } | null = null
const staged = vi.fn(() => {
  pending = { appVersion: '1.0.0', createdAt: '2026-11-27T10:00:00.000Z' }
  return { pending }
})
registerEndpoint('/api/backup/restore', { method: 'GET', handler: () => ({ pending }) })
registerEndpoint('/api/backup/restore', { method: 'POST', handler: staged })

// The confirm dialog renders inline in the test.
const stubs = {
  UModal: {
    props: ['open'],
    template: '<div v-if="open"><slot name="body" /><slot name="footer" /></div>',
  },
}

describe('RestoreCard (014 T006)', () => {
  it('stages a backup only after confirming and then asks for a restart', async () => {
    const wrapper = await mountSuspended(RestoreCard, { global: { stubs } })
    const input = wrapper.get<HTMLInputElement>('[data-testid="restore-file"]')
    const file = new File([new Uint8Array([80, 75, 3, 4])], 'backup.zip', {
      type: 'application/zip',
    })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(staged).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="restore-confirm"]').trigger('click')
    await vi.waitFor(() => expect(staged).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="restore-pending"]').text()).toContain('Neustart nötig'),
    )
  })
})
