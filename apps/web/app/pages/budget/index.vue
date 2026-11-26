<script setup lang="ts">
import type { CashflowSummary, SankeyResponse } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('nav.budget') })
const { query, setAnchor, granularity } = useBudgetPeriod()

const { data: summary } = await useApi<CashflowSummary>('/api/cashflow/summary', { query })
/** Sankey card between chart and categories like the reference (007 US4). */
const { data: graph } = await useApi<SankeyResponse>('/api/cashflow/sankey', {
  query,
  default: () => ({ nodes: [], links: [] }),
})
const unit = ref<'eur' | 'pct'>('eur')
const route = useRoute()
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.budget') }}</h1>
    <UCard v-if="summary">
      <PeriodSwitcher :label="summary.period.label" class="mb-4" />
      <CashflowBars
        :bars="summary.bars"
        :granularity="granularity"
        class="mb-4"
        @select="setAnchor"
      />
      <SummaryTiles :summary="summary" wide />
    </UCard>
    <UCard v-if="summary && graph && graph.links.length > 0" data-testid="sankey-card">
      <template #header>
        <CardTitle :title="t('charts.sankey')" :to="{ path: '/budget/sankey', query: route.query }">
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
        </CardTitle>
      </template>
      <SankeyChart
        :graph="graph"
        :income-cents="summary.incomeCents"
        :unit="unit"
        :max-height="420"
      />
      <div class="mt-3 flex justify-end">
        <UButton
          :to="{ path: '/budget/sankey', query: route.query }"
          variant="ghost"
          color="neutral"
          size="sm"
          trailing-icon="i-lucide-chevron-right"
          :label="t('charts.toSankey')"
          data-testid="sankey-open"
        />
      </div>
    </UCard>
    <CategoryList />
  </section>
</template>
