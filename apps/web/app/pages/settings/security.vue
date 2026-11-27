<script setup lang="ts">
/** Settings › Sicherheit (014 US4). */
const { t } = useI18n()
useHead({ title: t('settings.securityTitle') })
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.securityTitle') }}</h1>
    <SecurityCard />
  </section>
</template>
