<script setup lang="ts">
import type { BudgetDto } from '@finance/shared'

/** "Budgets" on the overview: spent vs. limit of the current month. */
const { t } = useI18n()
const { data } = await useApi<BudgetDto[]>('/api/budgets', {
  key: 'budgets-overview',
  default: () => [],
})
</script>

<template>
  <UCard data-testid="budgets-card">
    <template #header>
      <NuxtLink to="/budget/budgets" class="font-semibold link-hover">
        {{ t('overview.budgets.title') }}
      </NuxtLink>
    </template>
    <EmptyState
      v-if="(data?.length ?? 0) === 0"
      :title="t('overview.budgets.emptyTitle')"
      :description="t('overview.budgets.emptyDescription')"
      icon="i-lucide-piggy-bank"
      :action-label="t('overview.budgets.create')"
      action-to="/budget/budgets"
    />
    <BudgetProgressList v-else :budgets="data!" />
  </UCard>
</template>
