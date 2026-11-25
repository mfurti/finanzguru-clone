<script setup lang="ts">
import type { CashflowSummary } from '@finance/shared'

/** "Einnahmen & Ausgaben" on the overview: current month, 12 bars, tiles. */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const granularity = ref<'month' | 'quarter' | 'year'>('month')

const { data } = await useApi<CashflowSummary>('/api/cashflow/summary', {
  key: 'cashflow-overview',
  query: computed(() => ({ accounts: accountsParam.value, granularity: granularity.value })),
})
const hasData = computed(() =>
  (data.value?.bars ?? []).some((bar) => bar.incomeCents || bar.expenseCents),
)
</script>

<template>
  <UCard data-testid="cashflow-card">
    <template #header>
      <CardTitle :title="t('overview.cashflow.title')" to="/budget">
        <span class="flex items-center gap-2 text-sm">
          <span class="text-muted">{{ data?.period.label }}</span>
          <USelect
            v-model="granularity"
            :items="[
              { label: t('budget.month'), value: 'month' },
              { label: t('budget.quarter'), value: 'quarter' },
              { label: t('budget.year'), value: 'year' },
            ]"
            size="xs"
            class="w-24"
          />
        </span>
      </CardTitle>
    </template>
    <EmptyState
      v-if="!hasData"
      :title="t('overview.cashflow.empty')"
      icon="i-lucide-chart-column"
      :action-label="t('overview.empty.action')"
      action-to="/settings/sources"
    />
    <template v-else>
      <CashflowBars :bars="data!.bars" class="mb-3" />
      <SummaryTiles :summary="data!" />
    </template>
  </UCard>
</template>
