<script setup lang="ts">
/** Sub navigation of the Investments tab. */
const { t } = useI18n()
const route = useRoute()
const items = computed(() => [
  { label: t('investments.views.positions'), to: { path: '/investments', query: route.query } },
  {
    label: t('investments.views.transactions'),
    to: { path: '/investments/transactions', query: route.query },
  },
])
</script>

<template>
  <UNavigationMenu :items="items" class="mb-4 border-b border-default" />
</template>
