<script setup lang="ts">
import type { CashflowSummary, CategoryDetail } from '@finance/shared'

/**
 * Category detail (003 US3, FR-021): icon, name and total of the period,
 * 12-month history (current month hatched) and the bookings of the period.
 */
const { t } = useI18n()
const route = useRoute()
const id = computed(() => String(route.params.id))
const { query } = useBudgetPeriod()
const { data, error } = await useApi<CategoryDetail>(() => `/api/cashflow/categories/${id.value}`, {
  query,
})
const { colorOf, iconOf } = await useCategoryAppearance()
const { data: summary } = await useApi<CashflowSummary>('/api/cashflow/summary', { query })
const periodLabel = computed(() => summary.value?.period.label ?? '')
useHead({ title: computed(() => data.value?.name ?? t('budget.categories')) })

/** Bookings of the selected period for this category (sub categories included). */
const range = computed(() => {
  const anchor = query.value.anchor
  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7)) - 1
  const g = query.value.granularity
  const start = g === 'month' ? month : g === 'quarter' ? Math.floor(month / 3) * 3 : 0
  const span = g === 'month' ? 1 : g === 'quarter' ? 3 : 12
  return {
    from: new Date(Date.UTC(year, start, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, start + span, 0)).toISOString().slice(0, 10),
  }
})
const fixed = computed(() => ({ categoryIds: [id.value], ...range.value }))
const history = computed(() => data.value?.history ?? [])
</script>

<template>
  <section class="space-y-4" data-testid="category-detail">
    <EmptyState
      v-if="error || !data"
      :title="t('budget.noData')"
      icon="i-lucide-tags"
      :action-label="t('budget.analysis')"
      action-to="/budget"
    />
    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          :to="{ path: '/budget', query: route.query }"
          :aria-label="t('budget.analysis')"
        />
        <CategoryIcon :icon="iconOf(data.id)" :color="colorOf(data.id)" />
        <h1 class="text-xl font-bold">{{ data.name }}</h1>
        <Money
          :cents="data.kind === 'income' ? data.totalCents : -data.totalCents"
          signed
          class="ml-auto text-2xl font-bold"
          data-testid="category-detail-total"
        />
      </div>
      <UCard>
        <PeriodSwitcher :label="periodLabel" class="mb-4" />
        <template #header>
          <h2>{{ t('categoryDetail.history') }}</h2>
        </template>
        <MonthBars
          :months="history.map((point) => point.month)"
          :series="[
            {
              label: data.name,
              color: colorOf(data.id),
              values: history.map((point) => point.cents),
            },
          ]"
          :current-index="history.length - 1"
        />
      </UCard>
      <EmptyState
        v-if="data.totalCents === 0"
        :title="t('categoryDetail.empty')"
        icon="i-lucide-list"
      />
      <BookingsTable v-else :fixed="fixed" compact />
    </template>
  </section>
</template>
