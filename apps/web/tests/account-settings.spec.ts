import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import AccountSettingsList from '~/components/settings/AccountSettingsList.vue'

const base = {
  institutionId: 'i1',
  institutionName: 'Bank',
  type: 'checking',
  iban: null,
  parentAccountId: null,
  balanceCents: 0,
  isHidden: false,
  lastSyncedAt: null,
  logo: null,
  logoSource: null,
  logoKey: null,
}
let accounts = [
  { ...base, id: 'a', name: 'Giro', sortOrder: 0, archivedAt: null },
  { ...base, id: 'b', name: 'Tagesgeld', sortOrder: 1, archivedAt: null },
  { ...base, id: 'c', name: 'Altes Konto', sortOrder: 2, archivedAt: '2026-01-01T00:00:00Z' },
]
const order = vi.fn()
registerEndpoint('/api/accounts', { method: 'GET', handler: () => accounts })
registerEndpoint('/api/accounts/order', {
  method: 'POST',
  // The list sends Tagesgeld, Giro, then the archived account.
  handler: () => {
    order()
    accounts = ['b', 'a', 'c'].map((id, index) => ({
      ...accounts.find((acc) => acc.id === id)!,
      sortOrder: index,
    }))
    return accounts
  },
})

describe('AccountSettingsList (014 T004)', () => {
  it('lists active and archived accounts apart and moves an account down', async () => {
    const wrapper = await mountSuspended(AccountSettingsList)
    await vi.waitFor(() =>
      expect(wrapper.findAll('[data-testid="account-setting"]')).toHaveLength(2),
    )
    expect(wrapper.get('[data-testid="archived-accounts"]').text()).toContain('Altes Konto')

    await wrapper.findAll('[data-testid="account-down"]')[0]!.trigger('click')
    await vi.waitFor(() => expect(order).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(
        wrapper
          .findAll<HTMLInputElement>('input[data-testid="account-name"]')
          .map((input) => input.element.value),
      ).toEqual(['Tagesgeld', 'Giro']),
    )
  })
})
