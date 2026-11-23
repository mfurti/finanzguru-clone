<script setup lang="ts">
/** "Ungeprüfte Transaktionen": count with a link to the review list. Hidden when 0. */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()

const { data } = await useApi<{ count: number }>('/api/transactions/unreviewed/count', {
  query: { accounts: accountsParam },
  default: () => ({ count: 0 }),
})

const count = computed(() => data.value?.count ?? 0)
const formatted = computed(() => new Intl.NumberFormat('de-DE').format(count.value))
</script>

<template>
  <UCard v-if="count > 0" data-testid="review-banner" :ui="{ body: 'py-3 sm:py-3' }">
    <div class="flex items-center justify-between gap-3">
      <span class="flex items-center gap-2">
        <span class="size-2 rounded-full bg-primary" />
        <span class="text-lg font-semibold tabular-nums">{{ formatted }}</span>
        <span class="text-sm text-muted">{{ t('overview.review.label') }}</span>
      </span>
      <UButton
        to="/budget/review"
        variant="ghost"
        color="neutral"
        :label="t('overview.review.action')"
        trailing-icon="i-lucide-chevron-right"
      />
    </div>
  </UCard>
</template>
