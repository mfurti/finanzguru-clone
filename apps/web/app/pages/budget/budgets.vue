<script setup lang="ts">
import type { BudgetsOverview, CashflowSummary } from '@finance/shared'

/**
 * Budget › Budgets (003 US4, FR-022): 12-month chart of budget vs. spending
 * (Gesamtbudget or one budget) and the table for the selected month.
 */
type Row = BudgetsOverview['rows'][number]
const { t } = useI18n()
useHead({ title: t('budget.budgets.title') })
const { query, anchor } = useBudgetPeriod()
const period = computed(() => anchor.value.slice(0, 7))
const { data, refresh } = await useApi<BudgetsOverview>('/api/budgets/overview', {
  key: 'budgets-page',
  query: { period },
})
const { data: summary } = await useApi<CashflowSummary>('/api/cashflow/summary', { query })
const { colorOf } = await useCategoryAppearance()

/** "Gesamtbudget" or the id of one budget for the chart. */
const shown = ref<string>('total')
const chartItems = computed(() => [
  { label: t('budgetsPage.totalBudget'), value: 'total' },
  ...(data.value?.rows ?? []).map((row) => ({ label: row.name, value: row.id })),
])
const chart = computed(() => {
  const series = data.value?.series ?? []
  const row = data.value?.rows.find((item) => item.id === shown.value)
  const points = series.map((point) => (row ? point.byBudget[row.id]! : point.total))
  return {
    months: series.map((point) => point.month),
    series: [
      {
        label: t('budgetsPage.budget'),
        color: 'var(--ui-text-muted)',
        values: points.map((point) => point.budgetCents),
      },
      {
        label: t('budgetsPage.spent'),
        color: row ? colorOf(row.categoryId) : 'var(--ui-primary)',
        values: points.map((point) => point.spentCents),
      },
    ],
  }
})
watch(data, () => {
  if (shown.value !== 'total' && !data.value?.rows.some((row) => row.id === shown.value)) {
    shown.value = 'total'
  }
})

const modalOpen = ref(false)
const editing = ref<{ id: string; categoryId: string; limitCents: number } | null>(null)
function add(): void {
  editing.value = null
  modalOpen.value = true
}
function edit(row: Row): void {
  editing.value = { id: row.id, categoryId: row.categoryId, limitCents: row.limitCents }
  modalOpen.value = true
}
async function remove(row: Row): Promise<void> {
  if (!window.confirm(t('budgetsPage.deleteConfirm', { name: row.name }))) return
  await apiFetch(`/api/budgets/${row.id}`, { method: 'DELETE' })
  await saved()
}
async function saved(): Promise<void> {
  await Promise.all([refresh(), refreshNuxtData(['budgets', 'budgets-overview'])])
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('budget.budgets.title') }}</h1>
    <UCard>
      <PeriodSwitcher :label="summary?.period.label ?? ''" />
    </UCard>

    <UCard v-if="(data?.rows.length ?? 0) === 0" data-testid="budget-list">
      <EmptyState
        :title="t('budgetsPage.empty')"
        :description="t('budgetsPage.emptyInfo')"
        icon="i-lucide-piggy-bank"
        :action-label="t('budgetsPage.add')"
        data-testid="budget-empty"
        @action="add"
      />
    </UCard>
    <template v-else>
      <UCard data-testid="budget-chart">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2>{{ t('budgetsPage.chart') }}</h2>
            <USelect
              v-model="shown"
              :items="chartItems"
              class="w-56"
              data-testid="budget-chart-select"
            />
          </div>
        </template>
        <MonthBars
          :months="chart.months"
          :series="chart.series"
          :current-index="chart.months.length - 1"
        />
      </UCard>
      <UCard :ui="{ body: 'p-0 sm:p-0' }" data-testid="budget-list">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2>{{ t('budget.budgets.title') }}</h2>
            <UButton
              icon="i-lucide-plus"
              :label="t('budgetsPage.add')"
              data-testid="budget-add"
              @click="add"
            />
          </div>
        </template>
        <BudgetTable :data="data!" @edit="edit" @remove="remove" />
      </UCard>
    </template>
    <BudgetFormModal v-model:open="modalOpen" :edit="editing" @saved="saved" />
  </section>
</template>
