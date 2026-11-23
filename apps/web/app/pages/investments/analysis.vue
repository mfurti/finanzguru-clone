<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('analysis.title') })
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.investments') }}</h1>
    <InvestmentsNav />
    <BreakdownCard />
    <ReturnViews />
    <CompareChart />
  </section>
</template>
