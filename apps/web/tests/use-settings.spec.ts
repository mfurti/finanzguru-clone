import { DEFAULT_OWNER_SETTINGS } from '@finance/shared'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { useSettings } from '~/composables/useSettings'

describe('useSettings (014)', () => {
  it('loads once and applies a saved update', async () => {
    let gets = 0
    registerEndpoint('/api/settings', {
      method: 'GET',
      handler: () => {
        gets += 1
        return { ...DEFAULT_OWNER_SETTINGS, density: 'compact' }
      },
    })
    registerEndpoint('/api/settings', {
      method: 'PATCH',
      handler: () => ({ ...DEFAULT_OWNER_SETTINGS, density: 'compact', privacyMode: true }),
    })
    const { settings, load, update } = useSettings()
    await load()
    await load()
    expect(gets).toBe(1)
    expect(settings.value.density).toBe('compact')
    expect(await update({ privacyMode: true })).toBe(true)
    expect(settings.value.privacyMode).toBe(true)
  })
})
