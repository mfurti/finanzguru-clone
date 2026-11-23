import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AccountFormModal from '~/components/common/AccountFormModal.vue'
import AddMenu from '~/components/common/AddMenu.vue'

registerEndpoint('/api/accounts', () => [])

describe('AddMenu', () => {
  it('renders the Hinzufügen button', async () => {
    const wrapper = await mountSuspended(AddMenu)
    expect(wrapper.get('[data-testid="add-menu"]').text()).toContain('Hinzufügen')
  })
})

describe('AccountFormModal', () => {
  it('mounts closed without errors', async () => {
    const wrapper = await mountSuspended(AccountFormModal, { props: { open: false } })
    expect(wrapper.html()).not.toContain('NaN')
  })
})
