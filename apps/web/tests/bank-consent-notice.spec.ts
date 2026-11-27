import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import BankConsentNotice from '~/components/import/BankConsentNotice.vue'

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
let consentEndsAt = inDays(10)
registerEndpoint('/api/sources', {
  method: 'GET',
  handler: () => [
    {
      id: 'enable_banking',
      kind: 'enable_banking',
      status: 'active',
      consentEndsAt,
      consentWarning: true,
    },
  ],
})

describe('BankConsentNotice (014 T007)', () => {
  it('warns from 14 days before the bank consent ends, with the days left', async () => {
    consentEndsAt = inDays(10)
    const wrapper = await mountSuspended(BankConsentNotice, { route: '/settings/accounts' })
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="bank-consent-notice"]').text()).toContain('10'),
    )
  })
})
