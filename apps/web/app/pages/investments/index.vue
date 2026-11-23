<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('nav.investments') })
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.investments') }}</h1>
    <PerformanceChart />
    <PositionsTable />
  </section>
</template>
