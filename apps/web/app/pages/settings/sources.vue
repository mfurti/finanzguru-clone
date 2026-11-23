<script setup lang="ts">
import type { DataSourceDto } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('settings.sources') })

const { data: sources, refresh } = await useApi<DataSourceDto[]>('/api/sources', {
  default: () => [],
})

const statusColor = (status: DataSourceDto['status']) =>
  status === 'active'
    ? 'success'
    : status === 'planned' || status === 'disabled'
      ? 'neutral'
      : status === 'needs_reauth'
        ? 'warning'
        : 'error'
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">{{ t('settings.sources') }}</h1>
      <div class="flex gap-2">
        <UButton
          to="/settings/inflation"
          variant="soft"
          color="neutral"
          icon="i-lucide-percent"
          :label="t('settings.inflation')"
        />
        <UButton
          to="/settings/categories"
          variant="soft"
          color="neutral"
          icon="i-lucide-tags"
          :label="t('settings.categories')"
        />
      </div>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('import.title') }}</h2>
        <p class="text-sm text-muted">{{ t('import.subtitle') }}</p>
      </template>
      <CsvUpload @imported="refresh()" />
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('sources.title') }}</h2>
      </template>
      <ul class="divide-y divide-default" data-testid="sources-list">
        <li
          v-for="source in sources"
          :key="source.id"
          class="row-hover flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span>
            <span class="block font-medium">{{ source.displayName }}</span>
            <span v-if="source.lastSyncAt" class="text-xs text-muted">
              {{
                t('sources.lastSync', { at: new Date(source.lastSyncAt).toLocaleString('de-DE') })
              }}
            </span>
          </span>
          <UBadge
            :color="statusColor(source.status)"
            variant="subtle"
            :data-testid="`source-status-${source.kind}`"
            :title="source.status === 'planned' ? t('sources.plannedHint') : undefined"
          >
            {{ t(`sources.status.${source.status}`) }}
          </UBadge>
        </li>
      </ul>
    </UCard>
  </section>
</template>
