<script setup lang="ts">
import { formatDate, type TransactionListItem } from '@finance/shared'

/** Unreviewed, uncategorized bookings: pick a category (≤ 2 clicks, SC-005), optionally as rule. */
const { t } = useI18n()
useHead({ title: t('budget.review.title') })
const { accountsParam } = useAccountFilter()
const toast = useToast()

const { items: categoryItems } = await useCategoryOptions()
const { data, refresh } = await useApi<{ items: TransactionListItem[]; total: number }>(
  '/api/transactions',
  {
    query: computed(() => ({
      accounts: accountsParam.value,
      status: 'unreviewed',
      categoryId: 'uncategorized',
      pageSize: 100,
    })),
    default: () => ({ items: [], total: 0 }),
  },
)

/** Per row: save a rule for the counterparty (default on). */
const saveRule = ref<Record<string, boolean>>({})

async function assign(row: TransactionListItem, categoryId: string): Promise<void> {
  const withRule = saveRule.value[row.id] !== false && !!row.counterparty
  const result = await apiFetch<{ updated: number }>(`/api/transactions/${row.id}`, {
    method: 'PATCH',
    body: {
      categoryId,
      ...(withRule && {
        createRule: { matchField: 'counterparty', operator: 'equals', pattern: row.counterparty },
      }),
    },
  })
  toast.add({ title: t('budget.review.applied', { n: result.updated }), color: 'success' })
  await refresh()
  await refreshNuxtData()
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.budget') }}</h1>
    <BudgetNav />
    <UCard data-testid="review-list">
      <template #header>
        <h2 class="font-semibold">{{ t('budget.review.title') }} ({{ data!.total }})</h2>
      </template>
      <EmptyState
        v-if="data!.items.length === 0"
        :title="t('budget.review.empty')"
        icon="i-lucide-check-check"
      />
      <ul v-else class="divide-y divide-default">
        <li
          v-for="row in data!.items"
          :key="row.id"
          class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          :data-testid="`review-${row.id}`"
        >
          <div class="min-w-0">
            <div class="truncate font-medium">{{ row.counterparty ?? row.purpose ?? '–' }}</div>
            <div class="text-xs text-muted">
              {{ formatDate(row.bookingDate) }} · {{ row.accountName }}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <Money :cents="row.amountCents" signed class="font-medium" />
            <USelectMenu
              :items="categoryItems"
              value-key="value"
              :placeholder="t('budget.review.category')"
              class="w-56"
              data-testid="review-category"
              @update:model-value="(value: string) => assign(row, value)"
            />
            <UCheckbox
              v-if="row.counterparty"
              :model-value="saveRule[row.id] !== false"
              :label="t('budget.review.saveRule')"
              @update:model-value="(value) => (saveRule[row.id] = value === true)"
            />
          </div>
        </li>
      </ul>
    </UCard>
  </section>
</template>
