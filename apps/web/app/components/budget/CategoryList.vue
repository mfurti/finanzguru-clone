<script setup lang="ts">
import type { CashflowCategories, TransactionListItem } from '@finance/shared'
import { formatDate } from '@finance/shared'
import { VisDonut, VisSingleContainer } from '@unovis/vue'

/** Expense/income categories of the period with counts, totals, donut and drill-down. */
const { t } = useI18n()
const { query } = useBudgetPeriod()
const kind = ref<'expense' | 'income'>('expense')
const selected = ref<string | null>(null)

const { data } = await useApi<CashflowCategories>('/api/cashflow/categories', {
  query: computed(() => ({ ...query.value, kind: kind.value })),
  default: () => ({ totalCents: 0, count: 0, items: [] }),
})

const PALETTE = [
  '#6366f1',
  '#10b981',
  '#f43f5e',
  '#f59e0b',
  '#0ea5e9',
  '#8b5cf6',
  '#14b8a6',
  '#ec4899',
  '#84cc16',
  '#64748b',
]
type Item = CashflowCategories['items'][number]
const colorOf = (_: Item, index: number) => PALETTE[index % PALETTE.length]!
const value = (item: Item) => item.totalCents
const sign = computed(() => (kind.value === 'expense' ? -1 : 1))

// Drill-down: bookings of the selected category in the period.
const periodRange = computed(() => {
  const anchor = query.value.anchor
  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7)) - 1
  const start =
    query.value.granularity === 'month'
      ? month
      : query.value.granularity === 'quarter'
        ? Math.floor(month / 3) * 3
        : 0
  const span =
    query.value.granularity === 'month' ? 1 : query.value.granularity === 'quarter' ? 3 : 12
  const from = new Date(Date.UTC(year, start, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, start + span, 0)).toISOString().slice(0, 10)
  return { from, to }
})
const { data: bookings } = await useApi<{ items: TransactionListItem[]; total: number }>(
  '/api/transactions',
  {
    query: computed(() => ({
      accounts: query.value.accounts,
      categoryId: selected.value ?? undefined,
      ...periodRange.value,
      pageSize: 100,
    })),
    immediate: false,
    watch: [selected],
    default: () => ({ items: [], total: 0 }),
  },
)
watch([kind, query], () => (selected.value = null))
</script>

<template>
  <UCard data-testid="category-list">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('budget.categories') }}</h2>
        <UTabs
          v-model="kind"
          :items="[
            { label: t('budget.expenses'), value: 'expense' },
            { label: t('budget.income'), value: 'income' },
          ]"
          :content="false"
          size="xs"
        />
      </div>
    </template>
    <EmptyState v-if="data!.items.length === 0" :title="t('budget.noData')" icon="i-lucide-tags" />
    <div v-else class="flex flex-col gap-4 md:flex-row">
      <ul class="w-full divide-y divide-default text-sm">
        <li class="flex justify-between py-2 font-semibold">
          <span
            >{{ kind === 'expense' ? t('budget.expensesTotal') : t('budget.incomeTotal') }} ({{
              data!.count
            }})</span
          >
          <Money :cents="sign * data!.totalCents" />
        </li>
        <li v-for="(item, index) in data!.items" :key="item.categoryId">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-elevated"
            :data-testid="`category-${item.name}`"
            @click="selected = selected === item.categoryId ? null : item.categoryId"
          >
            <span class="flex items-center gap-2">
              <span class="size-2.5 rounded-full" :style="{ background: colorOf(item, index) }" />
              {{ item.name }} <span class="text-muted">({{ item.count }})</span>
            </span>
            <Money :cents="sign * item.totalCents" />
          </button>
          <ul
            v-if="selected === item.categoryId"
            class="mb-2 ml-5 divide-y divide-default text-xs"
            data-testid="category-bookings"
          >
            <li
              v-for="booking in bookings!.items"
              :key="booking.id"
              class="flex justify-between gap-2 py-1"
            >
              <span class="truncate"
                >{{ formatDate(booking.bookingDate) }} ·
                {{ booking.counterparty ?? booking.purpose }}</span
              >
              <Money :cents="booking.amountCents" />
            </li>
          </ul>
        </li>
      </ul>
      <div class="mx-auto size-44 shrink-0">
        <ClientOnly>
          <VisSingleContainer :data="data!.items" :height="176">
            <VisDonut :value="value" :color="colorOf" :arc-width="20" />
          </VisSingleContainer>
        </ClientOnly>
      </div>
    </div>
  </UCard>
</template>
