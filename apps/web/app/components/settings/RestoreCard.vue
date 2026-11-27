<script setup lang="ts">
import type { FetchError } from 'ofetch'

interface BackupManifest {
  appVersion: string
  createdAt: string
}

/**
 * Settings › Daten (014 US1): restore a backup. The file is checked and staged by the API;
 * it replaces all data on the next start of the app, after the owner confirmed it here.
 */
const { t } = useI18n()
const toast = useToast()
const { data, refresh } = await useApi<{ pending: BackupManifest | null }>('/api/backup/restore', {
  default: () => ({ pending: null }),
})
const file = ref<File | null>(null)
const confirmOpen = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)

const pendingDate = computed(() =>
  data.value?.pending
    ? new Date(data.value.pending.createdAt).toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '',
)

function choose(event: Event): void {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
  input.value = ''
  error.value = null
  if (file.value) confirmOpen.value = true
}

async function stage(): Promise<void> {
  if (!file.value) return
  busy.value = true
  error.value = null
  try {
    const form = new FormData()
    form.append('file', file.value)
    data.value = await apiFetch<{ pending: BackupManifest }>('/api/backup/restore', {
      method: 'POST',
      body: form,
    })
    confirmOpen.value = false
  } catch (caught) {
    const fetchError = caught as FetchError<{ statusMessage?: string; message?: string }>
    error.value =
      fetchError.data?.statusMessage ??
      fetchError.data?.message ??
      t('settings.dataPage.restoreFailed')
    confirmOpen.value = false
  } finally {
    busy.value = false
    file.value = null
  }
}

async function cancel(): Promise<void> {
  try {
    await apiFetch('/api/backup/restore', { method: 'DELETE' })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
  await refresh()
}
</script>

<template>
  <UCard data-testid="restore-card">
    <template #header>
      <h2 class="font-semibold">{{ t('settings.dataPage.restoreTitle') }}</h2>
      <p class="text-sm text-muted">{{ t('settings.dataPage.restoreHint') }}</p>
    </template>

    <UAlert
      v-if="data?.pending"
      color="warning"
      variant="subtle"
      icon="i-lucide-rotate-ccw"
      :title="t('settings.dataPage.restorePending')"
      :description="t('settings.dataPage.restorePendingText', { date: pendingDate })"
      :actions="[
        {
          label: t('settings.dataPage.restoreCancel'),
          variant: 'soft',
          color: 'neutral',
          onClick: cancel,
        },
      ]"
      data-testid="restore-pending"
    />
    <div v-else class="space-y-2">
      <label
        class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-elevated px-3 py-1.5 text-sm font-medium hover:bg-accented"
      >
        <UIcon name="i-lucide-upload" class="size-4" />
        {{ t('settings.dataPage.restoreChoose') }}
        <input
          type="file"
          accept=".zip,application/zip"
          class="sr-only"
          data-testid="restore-file"
          @change="choose"
        />
      </label>
      <p v-if="error" class="text-sm text-error" data-testid="restore-error">{{ error }}</p>
    </div>

    <UModal v-model:open="confirmOpen" :title="t('settings.dataPage.restoreConfirmTitle')">
      <template #body>
        <p class="text-sm">{{ t('settings.dataPage.restoreConfirmText') }}</p>
        <p class="mt-2 truncate text-sm text-muted">{{ file?.name }}</p>
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
            :loading="busy"
            :label="t('settings.dataPage.restoreConfirm')"
            data-testid="restore-confirm"
            @click="stage"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
