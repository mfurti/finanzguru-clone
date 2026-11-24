<script setup lang="ts">
import type { CashflowSummary, SankeyResponse } from '@finance/shared'

/**
 * Budget › Sankey (003 US3, FR-019): period picker, the money-flow chart and
 * the bookings of the period below. Clicking a category block filters the
 * bookings to that category; clicking it again clears the filter.
 */
const { t } = useI18n()
useHead({ title: `${t('budget.nav.sankey')} · ${t('nav.budget')}` })
const { query } = useBudgetPeriod()
const unit = ref<'eur' | 'pct'>('eur')
const selected = ref<string | null>(null)
watch(query, () => (selected.value = null))

const { data: summary } = await useApi<CashflowSummary>('/api/cashflow/summary', { query })
const { data: graph } = await useApi<SankeyResponse>('/api/cashflow/sankey', {
  query,
  default: () => ({ nodes: [], links: [] }),
})
const fixed = computed(() => ({
  from: summary.value?.period.from,
  to: summary.value?.period.to,
  ...(selected.value ? { categoryIds: [selected.value] } : {}),
}))
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('budget.nav.sankey') }}</h1>
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <PeriodSwitcher :label="summary?.period.label ?? ''" class="flex-1" />
          <UFieldGroup size="xs">
            <UButton
              :variant="unit === 'eur' ? 'soft' : 'ghost'"
              color="neutral"
              label="€"
              @click="unit = 'eur'"
            />
            <UButton
              :variant="unit === 'pct' ? 'soft' : 'ghost'"
              color="neutral"
              label="%"
              @click="unit = 'pct'"
            />
          </UFieldGroup>
        </div>
      </template>
      <SankeyChart
        :graph="graph!"
        :income-cents="summary?.incomeCents ?? 0"
        :unit="unit"
        :selected="selected"
        @select="(id) => (selected = id)"
      />
    </UCard>
    <BookingsTable v-if="summary" :key="selected ?? 'all'" :fixed="fixed" compact />
  </section>
</template>
