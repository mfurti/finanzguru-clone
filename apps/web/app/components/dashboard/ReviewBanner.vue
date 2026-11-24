<script setup lang="ts">
import { formatDate, type TransactionPage } from '@finance/shared'

/**
 * "Ungeprüfte Transaktionen" card (003 US6, FR-011): count and the latest
 * three unreviewed bookings, linking to Übersicht › Transaktionen. Hidden when 0.
 */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()

const { data } = await useApi<{ count: number }>('/api/transactions/unreviewed/count', {
  key: 'unreviewed-count-dashboard',
  query: { accounts: accountsParam },
  default: () => ({ count: 0 }),
})
const { data: latest } = await useApi<TransactionPage>('/api/transactions', {
  query: computed(() => ({
    accounts: accountsParam.value,
    review: 'unreviewed',
    pageSize: 3,
  })),
})

const count = computed(() => data.value?.count ?? 0)
const formatted = computed(() => new Intl.NumberFormat('de-DE').format(count.value))
const to = { path: '/transactions', query: { review: 'unreviewed' } }
</script>

<template>
  <UCard v-if="count > 0" data-testid="review-banner">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="flex items-center gap-2">
          <span class="size-2 rounded-full bg-primary" />
          {{ t('txws.unreviewed') }}
          <span class="text-muted tabular-nums">{{ formatted }}</span>
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
    </template>
    <ul class="divide-y divide-default text-sm" data-testid="review-latest">
      <li
        v-for="item in latest?.items ?? []"
        :key="item.id"
        class="flex items-center justify-between gap-3 py-2"
      >
        <span class="flex min-w-0 items-center gap-2">
          <Avatar :name="item.counterparty ?? item.purpose ?? '?'" size="sm" />
          <span class="min-w-0">
            <span class="block truncate font-medium">{{
              item.counterparty ?? item.purpose ?? t(`transactionTypes.${item.type}`)
            }}</span>
            <span class="text-xs text-muted">{{ formatDate(item.bookingDate) }}</span>
          </span>
        </span>
        <Money :cents="item.amountCents" signed class="shrink-0" />
      </li>
    </ul>
  </UCard>
</template>
