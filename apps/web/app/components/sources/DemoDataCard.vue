<script setup lang="ts">
/**
 * "Demo-Daten entfernen" (013 US1): shown only while demo data exists. One confirmed click
 * removes the demo banks, accounts, bookings, demo-only securities and the demo watchlist, so
 * every sum shows only the owner's data.
 */
const { t } = useI18n()
const toast = useToast()
const { data, refresh } = await useApi<{ present: boolean }>('/api/demo', {
  default: () => ({ present: false }),
})
const confirmOpen = ref(false)
const busy = ref(false)

async function remove(): Promise<void> {
  busy.value = true
  try {
    const removed = await apiFetch<{ accounts: number; transactions: number }>('/api/demo', {
      method: 'DELETE',
    })
    confirmOpen.value = false
    toast.add({
      title: t('demoData.removed', { accounts: removed.accounts, bookings: removed.transactions }),
      color: 'success',
    })
    await refresh()
    await refreshNuxtData()
  } catch {
    toast.add({ title: t('demoData.failed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard v-if="data?.present" data-testid="demo-data-card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold">{{ t('demoData.title') }}</h2>
        <p class="text-sm text-muted">{{ t('demoData.hint') }}</p>
      </div>
      <UButton
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        :label="t('demoData.remove')"
        data-testid="demo-remove"
        @click="confirmOpen = true"
      />
    </div>
    <UModal v-model:open="confirmOpen" :title="t('demoData.confirmTitle')">
      <template #body>
        <p class="text-sm">{{ t('demoData.confirmText') }}</p>
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
            :label="t('demoData.remove')"
            data-testid="demo-remove-confirm"
            @click="remove"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
