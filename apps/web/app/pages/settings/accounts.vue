<script setup lang="ts">
/** Settings › Konten (014 US1). */
const { t } = useI18n()
useHead({ title: t('settings.accounts') })
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.accounts') }}</h1>
    <AccountSettingsList />
  </section>
</template>
