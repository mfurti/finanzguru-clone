<script setup lang="ts">
import type { CashflowCategories } from '@finance/shared'
import { formatEur, formatPct } from '@finance/shared'

/** Expense/income categories of the period with counts, totals and pie chart (US5/US7); rows open the detail page (003 US3). */
const { t } = useI18n()
const route = useRoute()
const { query } = useBudgetPeriod()
const kind = ref<'expense' | 'income'>('expense')
/** Category under the mouse, shared by list and pie chart (US7). */
const hovered = ref<string | null>(null)
const unit = ref<'eur' | 'pct'>('eur')

const { data } = await useApi<CashflowCategories>('/api/cashflow/categories', {
  query: computed(() => ({ ...query.value, kind: kind.value })),
  default: () => ({ totalCents: 0, count: 0, items: [] }),
})

const { colorOf: categoryColor, iconOf } = await useCategoryAppearance()
type Item = CashflowCategories['items'][number]
const colorOf = (item: Item) => categoryColor(item.categoryId)
const sign = computed(() => (kind.value === 'expense' ? -1 : 1))
const display = (cents: number) =>
  unit.value === 'eur'
    ? formatEur(sign.value * cents)
    : formatPct(data.value!.totalCents ? cents / data.value!.totalCents : 0)
/** Chevron / donut click: open the category detail page (FR-021). */
function open(categoryId: string): void {
  void navigateTo({ path: `/budget/categories/${categoryId}`, query: route.query })
}
watch([kind, query], () => (hovered.value = null))
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
        <li v-for="item in data!.items" :key="item.categoryId">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-(--app-card-hover) sm:px-6"
            :class="{ 'bg-(--app-card-hover)': hovered === item.categoryId }"
            :data-testid="`category-${item.name}`"
            :data-hovered="hovered === item.categoryId || undefined"
            @click="open(item.categoryId)"
            @mouseenter="hovered = item.categoryId"
            @mouseleave="hovered = null"
          >
            <span class="flex min-w-0 items-center gap-3">
              <CategoryIcon :icon="iconOf(item.categoryId)" :color="colorOf(item)" />
              <span class="truncate font-medium">{{ item.name }}</span>
              <span class="text-muted">({{ item.count }})</span>
            </span>
            <span class="flex shrink-0 items-center gap-2 tabular-nums">
              {{ display(item.totalCents) }}
              <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
            </span>
          </button>
        </li>
      </ul>
      <div class="flex items-center justify-center p-6">
        <CategoryDonut
          v-model:hovered="hovered"
          :items="data!.items"
          :total-cents="data!.totalCents"
          :sign="sign"
          :kind="kind"
          :colors="colorOf"
          @select="open"
        />
      </div>
    </div>
  </UCard>
</template>
