<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('nav.investments') })
const view = ref<'positions' | 'assetClasses'>('positions')
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.investments') }}</h1>
    <PerformanceChart />
    <UTabs
      v-model="view"
      :items="[
        { label: t('investments.views.positions'), value: 'positions' },
        { label: t('investments.views.assetClasses'), value: 'assetClasses' },
      ]"
      :content="false"
      size="sm"
      class="w-full sm:w-auto"
    />
    <PositionsTable v-if="view === 'positions'" />
    <AssetClassTable v-else />
  </section>
</template>
