<script setup lang="ts">
/** "Budgets" on the overview. Filled with data in US5. */
const { t } = useI18n()
</script>

<template>
  <UCard data-testid="budgets-card">
    <template #header>
      <NuxtLink to="/budget/budgets" class="font-semibold hover:underline">
        {{ t('overview.budgets.title') }}
      </NuxtLink>
    </template>
    <EmptyState
      :title="t('overview.budgets.emptyTitle')"
      :description="t('overview.budgets.emptyDescription')"
      icon="i-lucide-piggy-bank"
      :action-label="t('overview.budgets.create')"
      action-to="/budget/budgets"
    />
  </UCard>
</template>
