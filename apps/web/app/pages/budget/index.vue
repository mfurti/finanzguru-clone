<script setup lang="ts">
import type { CashflowSummary, SankeyResponse } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('nav.budget') })
const { query, setAnchor } = useBudgetPeriod()
const sankeyUnit = ref<'eur' | 'pct'>('eur')

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
        <div class="flex items-center justify-between gap-2">
          <h2>{{ t('budget.sankey') }}</h2>
          <UFieldGroup size="xs">
            <UButton
              :variant="sankeyUnit === 'eur' ? 'soft' : 'ghost'"
              color="neutral"
              label="€"
              @click="sankeyUnit = 'eur'"
            />
            <UButton
              :variant="sankeyUnit === 'pct' ? 'soft' : 'ghost'"
              color="neutral"
              label="%"
              @click="sankeyUnit = 'pct'"
            />
          </UFieldGroup>
        </div>
      </template>
      <SankeyChart :graph="graph!" :income-cents="summary?.incomeCents ?? 0" :unit="sankeyUnit" />
    </UCard>
    <CategoryList />
  </section>
</template>
