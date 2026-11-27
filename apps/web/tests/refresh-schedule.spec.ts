import { DEFAULT_OWNER_SETTINGS, type OwnerSettings } from '@finance/shared'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import RefreshScheduleCard from '~/components/settings/RefreshScheduleCard.vue'
import { useSettings } from '~/composables/useSettings'

const patches: Partial<OwnerSettings>[] = []
registerEndpoint('/api/settings', {
  method: 'PATCH',
  handler: () => {
    const next = { ...DEFAULT_OWNER_SETTINGS, ...patches.at(-1) }
    return next
  },
})

describe('RefreshScheduleCard (014 T007)', () => {
  it('shows the time field only for the daily schedule and saves it', async () => {
    const wrapper = await mountSuspended(RefreshScheduleCard)
    expect(wrapper.find('[data-testid="refresh-time"]').exists()).toBe(false)

    const { update, settings } = useSettings()
    const daily = { refreshSchedule: { mode: 'daily' as const, time: '06:00', hours: 6 } }
    patches.push(daily)
    await update(daily)
    await vi.waitFor(() => expect(wrapper.find('input[type="time"]').exists()).toBe(true))

    const time = wrapper.get<HTMLInputElement>('input[type="time"]')
    patches.push({ refreshSchedule: { mode: 'daily', time: '07:30', hours: 6 } })
    await time.setValue('07:30')
    await time.trigger('change')
    await vi.waitFor(() => expect(settings.value.refreshSchedule.time).toBe('07:30'))
  })
})
