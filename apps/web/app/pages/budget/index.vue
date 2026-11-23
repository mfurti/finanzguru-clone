<script setup lang="ts">
import type { CashflowSummary, SankeyResponse } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('nav.budget') })
const { query, setAnchor } = useBudgetPeriod()

const { data: summary } = await useApi<CashflowSummary>('/api/cashflow/summary', { query })
const { data: graph } = await useApi<SankeyResponse>('/api/cashflow/sankey', {
  query,
  default: () => ({ nodes: [], links: [] }),
})
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.budget') }}</h1>
    <UCard v-if="summary">
      <PeriodSwitcher :label="summary.period.label" class="mb-4" />
      <CashflowBars :bars="summary.bars" class="mb-4" @select="setAnchor" />
      <SummaryTiles :summary="summary" />
    </UCard>
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('budget.sankey') }}</h2>
      </template>
      <SankeyChart :graph="graph!" :income-cents="summary?.incomeCents ?? 0" />
    </UCard>
    <CategoryList />
  </section>
</template>
