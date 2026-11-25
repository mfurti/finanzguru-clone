<script setup lang="ts">
import type { CashflowSummary } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('nav.budget') })
const { query, setAnchor, granularity } = useBudgetPeriod()

const { data: summary } = await useApi<CashflowSummary>('/api/cashflow/summary', { query })
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
      <SummaryTiles :summary="summary" />
    </UCard>
    <CategoryList />
  </section>
</template>
