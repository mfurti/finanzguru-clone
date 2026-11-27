<script setup lang="ts">
import type { OwnerSessionDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

/**
 * Settings › Sicherheit (014 US4): change the password, see and end sessions, automatic
 * logout. Passwords stay in the form only; they are never shown or stored in the browser.
 */
const { t } = useI18n()
const toast = useToast()
const { settings, update } = useSettings()

const { data: sessions, refresh } = await useApi<OwnerSessionDto[]>('/api/auth/sessions', {
  default: () => [],
})

const current = ref('')
const next = ref('')
const repeat = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const canSave = computed(
  () => current.value.length > 0 && next.value.length >= 12 && next.value === repeat.value,
)

async function changePassword(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    await apiFetch('/api/auth/password', {
      method: 'POST',
      body: { current: current.value, next: next.value },
    })
    current.value = next.value = repeat.value = ''
    toast.add({ title: t('settings.security.passwordChanged'), color: 'success' })
    await refresh()
  } catch (caught) {
    const fetchError = caught as FetchError<{ statusMessage?: string }>
    error.value = fetchError.data?.statusMessage ?? t('common.error')
  } finally {
    busy.value = false
  }
}

async function endOthers(): Promise<void> {
  try {
    await apiFetch('/api/auth/sessions', { method: 'DELETE' })
    toast.add({ title: t('settings.security.endedOthers'), color: 'success' })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
  await refresh()
}

const logoutChoices = computed(() =>
  ([0, 15, 30, 60, 240] as const).map((value) => ({
    label:
      value === 0
        ? t('settings.security.never')
        : t('settings.security.afterMinutes', { n: value }),
    value,
  })),
)

const when = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

/** Short device hint from the browser's user agent. */
function device(agent: string | null): string {
  if (!agent) return t('settings.security.unknownDevice')
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : null
  const system = /Windows/.test(agent)
    ? 'Windows'
    : /iPhone|iPad/.test(agent)
      ? 'iOS'
      : /Android/.test(agent)
        ? 'Android'
        : /Mac OS X/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : null
  return [browser, system].filter(Boolean).join(' · ') || agent.slice(0, 40)
}
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('settings.security.passwordTitle') }}</h2>
        <p class="text-sm text-muted">{{ t('settings.security.passwordHint') }}</p>
      </template>
      <form class="grid max-w-md gap-3" @submit.prevent="changePassword">
        <UFormField :label="t('settings.security.current')">
          <UInput
            v-model="current"
            type="password"
            autocomplete="current-password"
            class="w-full"
            data-testid="password-current"
          />
        </UFormField>
        <UFormField :label="t('settings.security.next')" :help="t('settings.security.nextHelp')">
          <UInput
            v-model="next"
            type="password"
            autocomplete="new-password"
            class="w-full"
            data-testid="password-next"
          />
        </UFormField>
        <UFormField
          :label="t('settings.security.repeat')"
          :error="repeat && repeat !== next ? t('settings.security.mismatch') : undefined"
        >
          <UInput
            v-model="repeat"
            type="password"
            autocomplete="new-password"
            class="w-full"
            data-testid="password-repeat"
          />
        </UFormField>
        <p v-if="error" class="text-sm text-error" data-testid="password-error">{{ error }}</p>
        <div>
          <UButton
            type="submit"
            :disabled="!canSave"
            :loading="busy"
            :label="t('settings.security.change')"
            data-testid="password-save"
          />
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t('settings.security.sessionsTitle') }}</h2>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-log-out"
            :label="t('settings.security.endOthers')"
            :disabled="(sessions?.length ?? 0) < 2"
            data-testid="sessions-end-others"
            @click="endOthers"
          />
        </div>
      </template>
      <ul class="divide-y divide-default text-sm" data-testid="sessions">
        <li v-for="session in sessions" :key="session.id" class="flex items-center gap-3 py-2">
          <UIcon name="i-lucide-monitor-smartphone" class="size-4 shrink-0 text-muted" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">
              {{ device(session.userAgent) }}
              <UBadge
                v-if="session.current"
                :label="t('settings.security.thisDevice')"
                color="primary"
                variant="soft"
                size="sm"
                class="ml-1"
              />
            </p>
            <p class="text-xs text-muted">
              {{ t('settings.security.lastSeen', { date: when(session.lastSeenAt) }) }}
            </p>
          </div>
        </li>
      </ul>
      <UFormField
        class="mt-4 max-w-xs"
        :label="t('settings.security.autoLogout')"
        :help="t('settings.security.autoLogoutHelp')"
      >
        <USelect
          :model-value="settings.autoLogoutMinutes"
          :items="logoutChoices"
          class="w-full"
          data-testid="setting-auto-logout"
          @update:model-value="
            update({ autoLogoutMinutes: Number($event) as 0 | 15 | 30 | 60 | 240 })
          "
        />
      </UFormField>
    </UCard>
  </div>
</template>
