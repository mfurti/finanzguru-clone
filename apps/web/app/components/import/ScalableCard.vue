<script setup lang="ts">
import type { ConnectResponse, DataSourceDto, SyncStarted } from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * Scalable Capital connection (004 US1, FR-001): connect via Scalable's own
 * login, status, last sync, manual sync, disconnect. The daily sync is a
 * server setting and only shown here.
 */
const props = defineProps<{ source: DataSourceDto | null }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref<'connect' | 'sync' | 'disconnect' | null>(null)

const status = computed(() => props.source?.status ?? 'disabled')
const connected = computed(() => status.value === 'active')
const badge = computed(
  () =>
    ({
      active: { color: 'success' as const, label: t('scalable.connected') },
      needs_reauth: { color: 'warning' as const, label: t('scalable.reauth') },
      error: { color: 'error' as const, label: t('scalable.error') },
      planned: { color: 'neutral' as const, label: t('scalable.disabled') },
      disabled: { color: 'neutral' as const, label: t('scalable.disabled') },
    })[status.value],
)
const lastSync = computed(() =>
  props.source?.lastSyncAt
    ? t('scalable.lastSync', { date: new Date(props.source.lastSyncAt).toLocaleString('de-DE') })
    : t('scalable.never'),
)

async function connect(): Promise<void> {
  busy.value = 'connect'
  try {
    const result = await apiFetch<ConnectResponse>('/api/sources/scalable/connect', {
      method: 'POST',
    })
    if (result.authorizationUrl) {
      // The owner logs in on Scalable's own page; Scalable redirects back to the callback.
      window.location.assign(result.authorizationUrl)
      return
    }
    toast.add({ title: t('scalable.connected'), color: 'success' })
    emit('changed')
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    busy.value = null
  }
}

async function sync(): Promise<void> {
  busy.value = 'sync'
  try {
    await apiFetch<SyncStarted>(`/api/sources/${props.source!.id}/sync`, { method: 'POST' })
    toast.add({ title: t('scalable.started'), icon: 'i-lucide-refresh-cw' })
    emit('changed')
  } catch (error) {
    const running = error instanceof FetchError && error.statusCode === 409
    toast.add({
      title: running ? t('scalable.running') : t('common.error'),
      color: running ? 'warning' : 'error',
    })
  } finally {
    busy.value = null
  }
}

const confirmOpen = ref(false)
async function disconnect(): Promise<void> {
  busy.value = 'disconnect'
  try {
    await apiFetch(`/api/sources/${props.source!.id}`, { method: 'DELETE' })
    confirmOpen.value = false
    emit('changed')
  } finally {
    busy.value = null
  }
}
/** Broker logo when the owner added one (009). */
const { byInstitution } = await useAccountLogos()
</script>

<template>
  <UCard data-testid="scalable-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-semibold">
          <MerchantLogo name="Scalable Capital" :logo="byInstitution('scalable')" size="sm" />
          {{ t('scalable.title') }}
        </h2>
        <UBadge :color="badge.color" variant="subtle" data-testid="scalable-status">
          {{ badge.label }}
        </UBadge>
      </div>
    </template>

    <p class="mb-3 text-sm text-muted">{{ t('scalable.info') }}</p>
    <div v-if="source" class="mb-3 space-y-1 text-sm" data-testid="scalable-last-sync">
      <p>{{ lastSync }}</p>
      <p v-if="source.lastRun" class="text-muted">
        {{
          t('scalable.lastRun', {
            imported: source.lastRun.imported,
            skipped: source.lastRun.skipped,
          })
        }}
      </p>
      <p v-if="source.lastError" class="text-error">{{ source.lastError }}</p>
      <p class="text-xs text-muted" data-testid="scalable-daily">
        {{ source.dailySync ? t('scalable.dailyOn') : t('scalable.dailyOff') }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="!connected"
        icon="i-lucide-link"
        :loading="busy === 'connect'"
        :label="status === 'needs_reauth' ? t('scalable.reauth') : t('scalable.connect')"
        data-testid="scalable-connect"
        @click="connect"
      />
      <UButton
        v-else
        icon="i-lucide-refresh-cw"
        :loading="busy === 'sync'"
        :label="t('scalable.sync')"
        data-testid="scalable-sync"
        @click="sync"
      />
      <UButton
        v-if="source && status !== 'disabled' && status !== 'planned'"
        icon="i-lucide-unlink"
        variant="ghost"
        color="neutral"
        :label="t('scalable.disconnect')"
        data-testid="scalable-disconnect"
        @click="confirmOpen = true"
      />
    </div>

    <UModal v-model:open="confirmOpen" :title="t('scalable.disconnect')">
      <template #body>
        <p class="text-sm">{{ t('scalable.disconnectConfirm') }}</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="confirmOpen = false"
          />
          <UButton
            color="error"
            :loading="busy === 'disconnect'"
            :label="t('scalable.disconnect')"
            data-testid="scalable-disconnect-confirm"
            @click="disconnect"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
