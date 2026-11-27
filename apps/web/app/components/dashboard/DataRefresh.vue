<script setup lang="ts">
import { formatDate } from '@finance/shared'

/**
 * "Aktualisieren" and "Stand" on the Übersicht (013 US2): one click fetches every connected
 * source (bank, broker, quotes) and reports each result; the state shows the oldest last
 * fetch of the connected sources, each source in the tooltip, highlighted when older than a
 * day. Without a connected source the button is disabled and the state is the newest booking.
 */
interface SourceState {
  source: string
  name: string
  lastSuccessAt: string | null
  lastError: string | null
}
interface DataState {
  oldestSuccessAt: string | null
  outdated: boolean
  sources: SourceState[]
  newestBookingDate: string | null
}
interface RefreshResult {
  source: string
  name: string
  ok: boolean
  error: string | null
}

const { t } = useI18n()
const toast = useToast()
const { data: state, refresh: refreshState } = await useApi<DataState>('/api/sources/state', {
  key: 'data-state',
})
const busy = ref(false)

const time = (iso: string) =>
  `${formatDate(iso.slice(0, 10))}, ${new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
const label = computed(() => {
  const value = state.value
  if (!value) return ''
  if (value.sources.length === 0)
    return value.newestBookingDate
      ? t('dataState.lastBooking', { date: formatDate(value.newestBookingDate) })
      : ''
  return value.oldestSuccessAt
    ? t('dataState.label', { time: time(value.oldestSuccessAt) })
    : t('dataState.never')
})
const tooltip = computed(() =>
  (state.value?.sources ?? [])
    .map(
      (row) =>
        `${row.name}: ${row.lastSuccessAt ? time(row.lastSuccessAt) : t('dataState.neverShort')}${row.lastError ? ` (${row.lastError})` : ''}`,
    )
    .join('\n'),
)
const canRefresh = computed(() => (state.value?.sources.length ?? 0) > 0)

async function refreshAll(): Promise<void> {
  busy.value = true
  try {
    const results = await apiFetch<RefreshResult[]>('/api/sources/refresh-all', { method: 'POST' })
    const failed = results.filter((row) => !row.ok)
    toast.add({
      title: failed.length === 0 ? t('dataState.done') : t('dataState.partly'),
      description: results
        .map(
          (row) =>
            `${row.name}: ${row.ok ? t('dataState.ok') : (row.error ?? t('dataState.failed'))}`,
        )
        .join(' · '),
      color: failed.length === 0 ? 'success' : 'warning',
    })
    await refreshNuxtData()
  } catch {
    toast.add({ title: t('dataState.failed'), color: 'error' })
  } finally {
    busy.value = false
    await refreshState()
  }
}
</script>

<template>
  <div class="flex items-center gap-2" data-testid="data-refresh">
    <UTooltip v-if="label" :text="tooltip || label" :disabled="!tooltip">
      <span
        class="hidden text-xs whitespace-nowrap sm:inline"
        :class="state?.outdated ? 'text-warning' : 'text-muted'"
        data-testid="data-state"
        :data-outdated="state?.outdated || undefined"
      >
        {{ label }}
      </span>
    </UTooltip>
    <UTooltip :text="t('dataState.noSource')" :disabled="canRefresh">
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        :aria-label="t('dataState.refresh')"
        :loading="busy"
        :disabled="!canRefresh"
        data-testid="refresh-all"
        @click="refreshAll"
      >
        <!-- Icon only on phones, so the action row fits at 375 px. -->
        <span class="hidden sm:inline">{{ t('dataState.refresh') }}</span>
      </UButton>
    </UTooltip>
  </div>
</template>
