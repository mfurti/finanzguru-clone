import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import SecurityCard from '~/components/settings/SecurityCard.vue'

const changed = vi.fn(() => null)
registerEndpoint('/api/auth/sessions', {
  method: 'GET',
  handler: () => [
    {
      id: 's1',
      createdAt: '2026-11-27T08:00:00.000Z',
      lastSeenAt: '2026-11-27T09:00:00.000Z',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0',
      current: true,
    },
  ],
})
registerEndpoint('/api/auth/password', { method: 'POST', handler: changed })

describe('SecurityCard (014 T013)', () => {
  it('lists sessions and changes the password only with a valid, repeated new one', async () => {
    const wrapper = await mountSuspended(SecurityCard)
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="sessions"]').text()).toContain('Chrome · Windows'),
    )
    expect(wrapper.get('[data-testid="sessions"]').text()).toContain('Dieses Gerät')

    const save = () => wrapper.get('[data-testid="password-save"]')
    await wrapper.get('input[data-testid="password-current"]').setValue('altes-passwort')
    await wrapper.get('input[data-testid="password-next"]').setValue('ein-neues-langes-passwort')
    await wrapper.get('input[data-testid="password-repeat"]').setValue('etwas-anderes-passwort')
    expect(save().attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('stimmen nicht überein')

    await wrapper.get('input[data-testid="password-repeat"]').setValue('ein-neues-langes-passwort')
    expect(save().attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    await vi.waitFor(() =>
      expect(
        wrapper.get<HTMLInputElement>('input[data-testid="password-current"]').element.value,
      ).toBe(''),
    )
  })
})
