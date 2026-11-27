<script setup lang="ts">
/** Settings › Daten (014 US1): backup, export, demo data. */
const { t } = useI18n()
useHead({ title: t('settings.data') })
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.data') }}</h1>
    <RefreshScheduleCard />
    <BackupCard />
    <RestoreCard />
    <DemoDataCard />
  </section>
</template>
