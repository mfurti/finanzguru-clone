<script setup lang="ts">
/** "Einnahmen & Ausgaben" on the overview. Filled with data in US5. */
const { t } = useI18n()
</script>

<template>
  <UCard data-testid="cashflow-card">
    <template #header>
      <NuxtLink to="/budget" class="font-semibold hover:underline">
        {{ t('overview.cashflow.title') }}
      </NuxtLink>
    </template>
    <EmptyState
      :title="t('overview.cashflow.empty')"
      icon="i-lucide-chart-column"
      :action-label="t('overview.empty.action')"
      action-to="/settings/sources"
    />
  </UCard>
</template>
