<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('analysis.title') })
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.investments') }}</h1>
    <BreakdownCard />
    <ReturnViews />
    <CompareChart />
  </section>
</template>
