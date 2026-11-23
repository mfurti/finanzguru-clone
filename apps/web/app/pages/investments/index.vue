<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('nav.investments') })
</script>

<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">{{ t('nav.investments') }}</h1>
    <UCard>
      <EmptyState
        :title="t('placeholder.title')"
        :description="t('placeholder.description')"
        icon="i-lucide-hammer"
      />
    </UCard>
  </section>
</template>
