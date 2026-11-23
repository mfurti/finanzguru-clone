<script setup lang="ts">
const { t } = useI18n()
useHead({ title: t('nav.budget') })
</script>

<template>
  <section>
    <h1 class="mb-4 text-xl font-semibold">{{ t('nav.budget') }}</h1>
    <UCard>
      <EmptyState
        :title="t('placeholder.title')"
        :description="t('placeholder.description')"
        icon="i-lucide-hammer"
      />
    </UCard>
  </section>
</template>
