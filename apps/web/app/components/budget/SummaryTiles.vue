<script setup lang="ts">
import type { CashflowSummary } from '@finance/shared'

/** Einnahmen / Ausgaben / Saldo / Gespart / Sparquote. */
defineProps<{ summary: CashflowSummary }>()
const { t } = useI18n()
</script>

<template>
  <div class="space-y-2" data-testid="summary-tiles">
    <div
      class="grid grid-cols-3 divide-x divide-default rounded-lg border border-default text-center"
    >
      <div class="p-3">
        <div class="text-xs text-muted">{{ t('budget.income') }}</div>
        <div class="font-semibold text-success" data-testid="tile-income">
          <Money :cents="summary.incomeCents" />
        </div>
      </div>
      <div class="p-3">
        <div class="text-xs text-muted">{{ t('budget.expenses') }}</div>
        <div class="font-semibold text-error" data-testid="tile-expenses">
          <Money :cents="-summary.expenseCents" />
        </div>
      </div>
      <div class="p-3">
        <div class="text-xs text-muted">{{ t('budget.balance') }}</div>
        <div class="font-semibold" data-testid="tile-balance">
          <Money :cents="summary.balanceCents" signed />
        </div>
      </div>
    </div>
    <div
      class="grid grid-cols-2 divide-x divide-default rounded-lg border border-default text-center"
    >
      <div class="p-3">
        <div class="flex items-center justify-center gap-1 text-xs text-muted">
          {{ t('budget.saved') }} <InfoTooltip :text="t('budget.savedInfo')" />
        </div>
        <div class="font-semibold text-success"><Money :cents="summary.savedCents" /></div>
      </div>
      <div class="p-3">
        <div class="flex items-center justify-center gap-1 text-xs text-muted">
          {{ t('budget.savingsRate') }} <InfoTooltip :text="t('budget.savingsRateInfo')" />
        </div>
        <div class="font-semibold"><Percent :value="summary.savingsRate" /></div>
      </div>
    </div>
  </div>
</template>
