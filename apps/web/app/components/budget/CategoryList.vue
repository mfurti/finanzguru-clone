<script setup lang="ts">
import type { CashflowCategories, TransactionListItem } from '@finance/shared'
import { formatDate, formatEur, formatPct } from '@finance/shared'

/** Expense/income categories of the period with counts, totals, pie chart and drill-down (US5/US7). */
const { t } = useI18n()
const { query } = useBudgetPeriod()
const kind = ref<'expense' | 'income'>('expense')
const selected = ref<string | null>(null)
/** Category under the mouse, shared by list and pie chart (US7). */
const hovered = ref<string | null>(null)
const unit = ref<'eur' | 'pct'>('eur')

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
const sign = computed(() => (kind.value === 'expense' ? -1 : 1))
const display = (cents: number) =>
  unit.value === 'eur'
    ? formatEur(sign.value * cents)
    : formatPct(data.value!.totalCents ? cents / data.value!.totalCents : 0)
function toggle(categoryId: string): void {
  selected.value = selected.value === categoryId ? null : categoryId
}

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
watch([kind, query], () => {
  selected.value = null
  hovered.value = null
})
</script>

<template>
  <!--
    Layout like the reference: header and body share one grid (list | chart).
    The header holds the title over the list, the Ausgaben/Einnahmen tabs over
    the chart (underline sits on the divider) and the €/% switch on the right.
  -->
  <UCard :ui="{ header: 'p-0 sm:p-0', body: 'p-0 sm:p-0' }" data-testid="category-list">
    <template #header>
      <div
        class="grid grid-cols-1 border-b border-default md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      >
        <div class="flex items-center justify-between gap-2 px-4 pt-5 pb-3 sm:px-6 sm:pt-6">
          <h2>{{ t('budget.categories') }}</h2>
        </div>
        <div class="flex items-end justify-between gap-2 px-4 pt-1 sm:px-6 md:pt-6">
          <div class="-mb-px flex gap-6" role="tablist">
            <button
              v-for="tab in [
                { label: t('budget.expenses'), value: 'expense' as const },
                { label: t('budget.income'), value: 'income' as const },
              ]"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="kind === tab.value"
              class="border-b-2 pb-3 text-sm font-medium transition-colors"
              :class="
                kind === tab.value
                  ? 'border-(--ui-text-highlighted) text-highlighted'
                  : 'border-transparent text-muted hover:text-default'
              "
              :data-testid="`category-kind-${tab.value}`"
              @click="kind = tab.value"
            >
              {{ tab.label }}
            </button>
          </div>
          <UFieldGroup size="sm" class="mb-2">
            <UButton
              :variant="unit === 'eur' ? 'soft' : 'ghost'"
              color="neutral"
              label="€"
              data-testid="category-unit-eur"
              @click="unit = 'eur'"
            />
            <UButton
              :variant="unit === 'pct' ? 'soft' : 'ghost'"
              color="neutral"
              label="%"
              data-testid="category-unit-pct"
              @click="unit = 'pct'"
            />
          </UFieldGroup>
        </div>
      </div>
    </template>

    <EmptyState
      v-if="data!.items.length === 0"
      :title="t('budget.noData')"
      icon="i-lucide-tags"
      class="p-6 md:min-h-[452px]"
    />
    <!-- Fixed minimum height so the card does not jump between Ausgaben and Einnahmen. -->
    <div
      v-else
      class="grid grid-cols-1 md:min-h-[452px] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <ul class="divide-y divide-default text-sm md:border-r md:border-default">
        <li
          class="flex items-center justify-between gap-3 px-4 py-3 font-semibold sm:px-6"
          data-testid="category-total"
        >
          <span>
            {{ kind === 'expense' ? t('budget.expensesTotal') : t('budget.incomeTotal') }}
            <span class="font-normal text-muted">({{ data!.count }})</span>
          </span>
          <span class="flex items-center gap-2 tabular-nums">
            {{ display(data!.totalCents) }}
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
          </span>
        </li>
        <li v-for="(item, index) in data!.items" :key="item.categoryId">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-(--app-card-hover) sm:px-6"
            :class="{ 'bg-(--app-card-hover)': hovered === item.categoryId }"
            :data-testid="`category-${item.name}`"
            :data-hovered="hovered === item.categoryId || undefined"
            :aria-expanded="selected === item.categoryId"
            @click="toggle(item.categoryId)"
            @mouseenter="hovered = item.categoryId"
            @mouseleave="hovered = null"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-md"
                :style="{ background: colorOf(item, index) }"
              >
                <UIcon name="i-lucide-tag" class="size-4 text-white" />
              </span>
              <span class="truncate font-medium">{{ item.name }}</span>
              <span class="text-muted">({{ item.count }})</span>
            </span>
            <span class="flex shrink-0 items-center gap-2 tabular-nums">
              {{ display(item.totalCents) }}
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 text-muted transition-transform"
                :class="{ 'rotate-90': selected === item.categoryId }"
              />
            </span>
          </button>
          <ul
            v-if="selected === item.categoryId"
            class="divide-y divide-default px-4 pb-2 pl-14 text-xs sm:px-6 sm:pl-16"
            data-testid="category-bookings"
          >
            <li
              v-for="booking in bookings!.items"
              :key="booking.id"
              class="flex justify-between gap-2 py-1.5"
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
      <div class="flex items-center justify-center p-6">
        <CategoryDonut
          v-model:hovered="hovered"
          :items="data!.items"
          :total-cents="data!.totalCents"
          :sign="sign"
          :colors="colorOf"
          @select="toggle"
        />
      </div>
    </div>
  </UCard>
</template>
