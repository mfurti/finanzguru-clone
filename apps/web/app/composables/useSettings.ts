import {
  DEFAULT_OWNER_SETTINGS,
  type OwnerSettings,
  type OwnerSettingsPatch,
} from '@finance/shared'

/**
 * Owner settings (014), loaded once per app and shared by every page. `update` applies the
 * change at once (optimistic) and rolls it back with a toast when the API refuses it.
 */
export function useSettings() {
  const settings = useState<OwnerSettings>('owner-settings', () => ({ ...DEFAULT_OWNER_SETTINGS }))
  const loaded = useState<boolean>('owner-settings-loaded', () => false)
  const nuxtApp = useNuxtApp()

  async function load(): Promise<void> {
    if (loaded.value) return
    const fetcher = import.meta.server ? useRequestFetch() : $fetch
    try {
      settings.value = await (fetcher as typeof $fetch)<OwnerSettings>('/api/settings')
      loaded.value = true
    } catch {
      // Not logged in yet or API down: keep the defaults; a later call retries.
    }
  }

  async function update(patch: OwnerSettingsPatch): Promise<boolean> {
    const before = settings.value
    settings.value = { ...before, ...patch }
    try {
      settings.value = await apiFetch<OwnerSettings>('/api/settings', {
        method: 'PATCH',
        body: patch,
      })
      return true
    } catch {
      settings.value = before
      useToast().add({ title: nuxtApp.$i18n.t('settings.saveFailed'), color: 'error' })
      return false
    }
  }

  return { settings: readonly(settings), loaded: readonly(loaded), load, update }
}
