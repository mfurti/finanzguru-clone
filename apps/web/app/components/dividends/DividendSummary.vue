<script setup lang="ts">
import type { DividendSummary } from '@finance/shared'

/** Tiles: Letzte 12 Monate, Ø pro Monat, Dividendenrendite YTD, CAGR (US2). */
defineProps<{ summary: DividendSummary }>()
const { t } = useI18n()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="dividend-summary">
    <UCard>
      <div class="text-xs text-muted">{{ t('dividends.last12') }}</div>
      <div class="text-lg font-semibold" data-testid="dividends-last12">
        <Money :cents="summary.last12Cents" animate />
      </div>
    </UCard>
    <UCard>
      <div class="text-xs text-muted">{{ t('dividends.avgMonth') }}</div>
      <div class="text-lg font-semibold" data-testid="dividends-avg">
        <Money :cents="summary.avgPerMonthCents" animate />
      </div>
    </UCard>
    <UCard>
      <div class="text-xs text-muted">{{ t('dividends.yieldYtd') }}</div>
      <div class="text-lg font-semibold"><Percent :value="summary.yieldYtd" /></div>
    </UCard>
    <UCard>
      <div class="text-xs text-muted">{{ t('dividends.cagr') }}</div>
      <div class="text-lg font-semibold"><Percent :value="summary.cagr" signed /></div>
    </UCard>
  </div>
</template>
