import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountFilter from '~/components/common/AccountFilter.vue'

registerEndpoint('/api/accounts', () => [
  {
    id: 'd1',
    name: 'Depot',
    type: 'depot',
    institutionName: 'Broker',
    isHidden: false,
    logo: null,
  },
  {
    id: 'g1',
    name: 'Giro',
    type: 'checking',
    institutionName: 'Bank',
    isHidden: false,
    logo: null,
  },
  {
    id: 'r1',
    name: 'Verrechnung',
    type: 'reference',
    institutionName: 'Broker',
    isHidden: false,
    logo: null,
  },
])

// The popover content is rendered inline so the options can be read.
const stubs = {
  UPopover: { template: '<div><slot /><slot name="content" /></div>' },
}

describe('AccountFilter (012 T007)', () => {
  // Signed in, so the auth middleware does not send the test route to /login.
  beforeEach(() => {
    useState('session').value = { displayName: 'Test' }
  })

  it('offers only portfolios in Investments', async () => {
    const wrapper = await mountSuspended(AccountFilter, {
      route: '/investments',
      global: { stubs },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Depot'), { timeout: 5000 })
    expect(wrapper.text()).toContain('Alle Portfolios')
    expect(wrapper.text()).toContain('Depot')
    expect(wrapper.text()).not.toContain('Giro')
    expect(wrapper.text()).not.toContain('Verrechnung')
  })

  it('offers all accounts elsewhere', async () => {
    const wrapper = await mountSuspended(AccountFilter, {
      route: '/transactions',
      global: { stubs },
    })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Giro'), { timeout: 5000 })
    expect(wrapper.text()).toContain('Alle Konten')
    expect(wrapper.text()).toContain('Giro')
    expect(wrapper.text()).toContain('Verrechnung')
  })
})
