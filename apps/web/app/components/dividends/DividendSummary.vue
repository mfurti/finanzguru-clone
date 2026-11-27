<script setup lang="ts">
import type { DividendSummary } from '@finance/shared'

/**
 * Three cards like the reference (012 P8): Investments (Portfoliowert, Dividenden des Jahres),
 * Dividendenerträge (letzte 12 Monate, Ø pro Monat) and Dividendenrendite (Jahr YTD, CAGR).
 */
defineProps<{ summary: DividendSummary }>()
const { t } = useI18n()
const year = new Date().getFullYear()
</script>

<template>
  <div class="grid gap-3 md:grid-cols-3" data-testid="dividend-summary">
    <UCard data-testid="dividends-card-investments">
      <h2 class="mb-3 font-semibold">{{ t('dividends.cards.investments') }}</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('dividends.cards.portfolioValue') }}</dt>
          <dd class="font-semibold" data-testid="dividends-portfolio">
            <Money :cents="summary.portfolioValueCents" animate />
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('dividends.cards.yearDividends', { year }) }}</dt>
          <dd class="font-semibold" data-testid="dividends-year">
            <Money :cents="summary.ytdCents" animate />
          </dd>
        </div>
      </dl>
    </UCard>
    <UCard data-testid="dividends-card-income">
      <h2 class="mb-3 font-semibold">{{ t('dividends.cards.income') }}</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('dividends.last12') }}</dt>
          <dd class="font-semibold" data-testid="dividends-last12">
            <Money :cents="summary.last12Cents" animate />
          </dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('dividends.avgMonth') }}</dt>
          <dd class="font-semibold" data-testid="dividends-avg">
            <Money :cents="summary.avgPerMonthCents" animate />
          </dd>
        </div>
      </dl>
    </UCard>
    <UCard data-testid="dividends-card-yield">
      <h2 class="mb-3 font-semibold">{{ t('dividends.cards.yield') }}</h2>
      <dl class="space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('dividends.cards.ytd', { year }) }}</dt>
          <dd class="font-semibold"><Percent :value="summary.yieldYtd" /></dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt class="text-muted">{{ t('dividends.cagr') }}</dt>
          <dd class="font-semibold"><Percent :value="summary.cagr" signed /></dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
