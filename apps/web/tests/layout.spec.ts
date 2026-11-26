import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import DefaultLayout from '~/layouts/default.vue'

registerEndpoint('/api/accounts', () => [
  {
    id: 'a1',
    institutionId: 'i1',
    institutionName: 'Demo Bank',
    name: 'Demo Girokonto',
    type: 'checking',
    iban: null,
    parentAccountId: null,
    balanceCents: 1000,
    isHidden: false,
    sortOrder: 0,
    lastSyncedAt: null,
  },
])

describe('default layout', () => {
  it('shows brand, the four tabs and the account filter', async () => {
    const wrapper = await mountSuspended(DefaultLayout)
    const text = wrapper.text()
    expect(text).toContain('Vermögenskompass')
    for (const tab of ['Übersicht', 'Investments', 'Budget', 'Versicherung']) {
      expect(text).toContain(tab)
    }
    expect(wrapper.find('[data-testid="account-filter"]').text()).toContain('Alle Konten')
  })
})
