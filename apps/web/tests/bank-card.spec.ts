import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import BankCard from '~/components/import/BankCard.vue'

const base = {
  id: 'enable_banking',
  kind: 'enable_banking' as const,
  displayName: 'Sparkasse Musterstadt',
  lastSyncAt: null,
  lastError: null,
  institution: 'Sparkasse Musterstadt',
  accounts: [{ id: 'a1', name: 'Girokonto …3000', maskedIban: 'DE89 •••• •••• 3000' }],
}

describe('BankCard (005 T014)', () => {
  it('offers to connect when no bank is connected', async () => {
    const wrapper = await mountSuspended(BankCard, { props: { source: null } })
    expect(wrapper.get('[data-testid="bank-connect"]').text()).toBe('Bank verbinden')
    expect(wrapper.find('[data-testid="bank-sync"]').exists()).toBe(false)
  })

  it('shows consent end, warning and approved accounts when active', async () => {
    const ends = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const wrapper = await mountSuspended(BankCard, {
      props: {
        source: { ...base, status: 'active', consentEndsAt: ends, consentWarning: true },
      },
    })
    expect(wrapper.get('[data-testid="bank-warning"]').text()).toContain('Tagen ab')
    expect(wrapper.get('[data-testid="bank-accounts"]').text()).toContain('DE89 •••• •••• 3000')
    expect(wrapper.find('[data-testid="bank-sync"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bank-renew"]').exists()).toBe(true)
  })

  it('asks to renew an expired consent', async () => {
    const wrapper = await mountSuspended(BankCard, {
      props: { source: { ...base, status: 'consent_expired', consentEndsAt: null } },
    })
    expect(wrapper.find('[data-testid="bank-expired"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="bank-connect"]').text()).toBe('Zugang erneuern')
  })
})
