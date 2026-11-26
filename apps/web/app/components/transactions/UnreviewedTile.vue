<script setup lang="ts">
/**
 * Unreviewed bookings (US1, research R5): count, "Nur ungeprüfte anzeigen"
 * (toggles the table filter in the URL) and "Alle als geprüft markieren"
 * for everything unreviewed in the current filter, after a confirmation.
 */
const props = defineProps<{ filter: Record<string, string>; onlyUnreviewed: boolean }>()
const emit = defineEmits<{ toggle: [on: boolean]; done: [] }>()
const { t } = useI18n()

/** Count for the table's filter (review forced to unreviewed by the API). */
const countQuery = computed(() => {
  const { review: _review, ...rest } = props.filter
  return rest
})
const { data, refresh } = await useApi<{ count: number }>('/api/transactions/unreviewed/count', {
  key: 'unreviewed-count',
  query: countQuery,
  default: () => ({ count: 0 }),
})
const count = computed(() => data.value?.count ?? 0)
const confirmOpen = ref(false)

async function markAll(): Promise<void> {
  await apiFetch('/api/transactions/bulk', {
    method: 'POST',
    body: { filter: { ...countQuery.value, review: 'unreviewed' }, action: 'markReviewed' },
  })
  confirmOpen.value = false
  await refresh()
  emit('done')
}
</script>

<template>
  <UCard data-testid="unreviewed-tile">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="text-sm text-muted">{{ t('txws.unreviewed') }}</p>
        <p class="mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums">
          <span v-if="count > 0" class="size-2.5 rounded-full bg-primary" />
          <span data-testid="unreviewed-count">{{ count }}</span>
        </p>
      </div>
      <div class="flex flex-col items-start gap-2 sm:items-end">
        <USwitch
          :model-value="onlyUnreviewed"
          :label="t('txws.onlyUnreviewed')"
          data-testid="only-unreviewed"
          @update:model-value="(value: boolean) => emit('toggle', value)"
        />
        <UButton
          :disabled="count === 0"
          size="sm"
          variant="soft"
          color="neutral"
          icon="i-lucide-check-check"
          :label="t('txws.markAllReviewed')"
          data-testid="mark-all-reviewed"
          @click="confirmOpen = true"
        />
      </div>
    </div>
    <UModal
      v-model:open="confirmOpen"
      :title="t('txws.markAllConfirm', { n: count })"
      :description="t('txws.markAllConfirmInfo')"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="confirmOpen = false"
          />
          <UButton
            :label="t('txws.markAllReviewed')"
            data-testid="mark-all-confirm"
            @click="markAll"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
