<script setup lang="ts">
import type { CashflowSummary } from '@finance/shared'

/**
 * Einnahmen / Ausgaben / Saldo / Gespart / Sparquote, framed like the reference (010 US4):
 * clearly bordered boxes on the darker page surface; Gespart and Sparquote as rows with the
 * label left and the value right. `wide` (Budget › Analyse) puts all five in one row from
 * 1280 px.
 */
withDefaults(defineProps<{ summary: CashflowSummary; wide?: boolean }>(), { wide: false })
const { t } = useI18n()
</script>

<template>
  <div
    class="grid gap-2"
    :class="wide ? 'xl:grid-cols-[3fr_2fr]' : ''"
    data-testid="summary-tiles"
    :data-wide="wide || undefined"
  >
    <div
      class="grid grid-cols-3 divide-x divide-accented rounded-xl border border-accented bg-(--app-page) text-center"
    >
      <div class="p-3">
        <div class="text-xs text-muted">{{ t('budget.income') }}</div>
        <div class="font-semibold text-success" data-testid="tile-income">
          <Money :cents="summary.incomeCents" animate />
        </div>
      </div>
      <div class="p-3">
        <div class="text-xs text-muted">{{ t('budget.expenses') }}</div>
        <div class="font-semibold text-error" data-testid="tile-expenses">
          <Money :cents="-summary.expenseCents" animate />
        </div>
      </div>
      <div class="p-3">
        <div class="text-xs text-muted">{{ t('budget.balance') }}</div>
        <div class="font-semibold" data-testid="tile-balance">
          <Money :cents="summary.balanceCents" signed animate />
        </div>
      </div>
    </div>
    <div
      class="grid grid-cols-1 divide-y divide-accented rounded-xl border border-accented bg-(--app-page) text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0"
      data-testid="saved-box"
    >
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <span class="flex items-center gap-1 text-muted">
          {{ t('budget.saved') }} <InfoTooltip :text="t('budget.savedInfo')" />
        </span>
        <span class="font-semibold text-success" data-testid="tile-saved">
          <Money :cents="summary.savedCents" animate />
        </span>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <span class="flex items-center gap-1 text-muted">
          {{ t('budget.savingsRate') }} <InfoTooltip :text="t('budget.savingsRateInfo')" />
        </span>
        <span class="font-semibold" data-testid="tile-savings-rate">
          <Percent :value="summary.savingsRate" />
        </span>
      </div>
    </div>
  </div>
</template>
