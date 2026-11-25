<script setup lang="ts">
/**
 * "Ungeprüfte Transaktionen" tile like the reference (007 US3): one line with dot, count,
 * label and "Alle anzeigen", linking to Übersicht › Transaktionen. Hidden when 0.
 */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()

const { data } = await useApi<{ count: number }>('/api/transactions/unreviewed/count', {
  key: 'unreviewed-count-dashboard',
  query: { accounts: accountsParam },
  default: () => ({ count: 0 }),
})

const count = computed(() => data.value?.count ?? 0)
const formatted = computed(() => new Intl.NumberFormat('de-DE').format(count.value))
const to = { path: '/transactions', query: { review: 'unreviewed' } }
</script>

<template>
  <UCard v-if="count > 0" data-testid="review-banner" :ui="{ body: 'py-3 sm:py-3' }">
    <div class="flex items-center justify-between gap-3">
      <h2 class="flex min-w-0 items-center gap-2 text-sm font-medium">
        <span class="size-2 shrink-0 rounded-full bg-primary" />
        <span class="tabular-nums" data-testid="review-count">{{ formatted }}</span>
        <span class="truncate">{{ t('txws.unreviewed') }}</span>
      </h2>
      <UButton
        :to="to"
        variant="ghost"
        color="neutral"
        size="sm"
        :label="t('refine.showAll')"
        trailing-icon="i-lucide-chevron-right"
      />
    </div>
  </UCard>
</template>
