<script setup lang="ts">
/** Sub navigation of the Budget tab. */
const { t } = useI18n()
const route = useRoute()
const items = computed(() => [
  { label: t('budget.nav.analysis'), to: { path: '/budget', query: route.query } },
  { label: t('budget.nav.review'), to: { path: '/budget/review', query: route.query } },
  { label: t('budget.nav.budgets'), to: { path: '/budget/budgets', query: route.query } },
])
</script>

<template>
  <UNavigationMenu :items="items" class="mb-4 border-b border-default" />
</template>
