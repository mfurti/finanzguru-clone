<script setup lang="ts">
/**
 * Settings › Daten (014 US1): backup download and CSV export of all bookings. Both are plain
 * downloads from the app's own API; nothing leaves the owner's server otherwise.
 */
const { t } = useI18n()
</script>

<template>
  <UCard data-testid="backup-card">
    <template #header>
      <h2 class="font-semibold">{{ t('settings.dataPage.backupTitle') }}</h2>
      <p class="text-sm text-muted">{{ t('settings.dataPage.backupHint') }}</p>
    </template>
    <div class="flex flex-wrap gap-2">
      <UButton
        icon="i-lucide-download"
        :label="t('settings.dataPage.backupDownload')"
        href="/api/backup"
        download
        external
        data-testid="backup-download"
      />
      <UButton
        icon="i-lucide-file-spreadsheet"
        color="neutral"
        variant="soft"
        :label="t('settings.dataPage.csvExport')"
        href="/api/transactions/export.csv"
        download
        external
        data-testid="csv-export"
      />
    </div>
  </UCard>
</template>
