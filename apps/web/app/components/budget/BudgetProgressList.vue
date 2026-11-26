<script setup lang="ts">
import type { BudgetDto } from '@finance/shared'

/** Spent vs. limit per budget; red when the limit is exceeded. */
defineProps<{ budgets: BudgetDto[]; removable?: boolean }>()
defineEmits<{ remove: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <ul class="space-y-4">
    <li v-for="budget in budgets" :key="budget.id" :data-testid="`budget-${budget.categoryName}`">
      <div class="mb-1 flex items-center justify-between gap-2 text-sm">
        <span class="font-medium">{{ budget.categoryName }}</span>
        <span class="flex items-center gap-2">
          <span class="tabular-nums">
            <Money :cents="budget.spentCents" /> / <Money :cents="budget.monthlyLimitCents" />
          </span>
          <UButton
            v-if="removable"
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="t('budget.budgets.delete')"
            @click="$emit('remove', budget.id)"
          />
        </span>
      </div>
      <UProgress
        :model-value="Math.min(100, (budget.spentCents / budget.monthlyLimitCents) * 100)"
        :color="budget.remainingCents < 0 ? 'error' : 'primary'"
        size="sm"
      />
      <div class="mt-1 text-xs" :class="budget.remainingCents < 0 ? 'text-error' : 'text-muted'">
        <template v-if="budget.remainingCents >= 0">
          <Money :cents="budget.remainingCents" /> {{ t('budget.budgets.remaining') }}
        </template>
        <template v-else>
          <Money :cents="-budget.remainingCents" /> {{ t('budget.budgets.over') }}
        </template>
      </div>
    </li>
  </ul>
</template>
