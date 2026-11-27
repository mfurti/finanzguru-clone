<script setup lang="ts">
import type { AboutDto } from '@finance/shared'

/** Settings › Über die App (014 US4): version, database size, last fetch per source. */
const { t } = useI18n()
useHead({ title: t('settings.about') })
const { data } = await useApi<AboutDto>('/api/about')

const size = computed(() => {
  const bytes = data.value?.databaseBytes ?? 0
  const mb = bytes / 1024 / 1024
  return mb >= 1
    ? `${mb.toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
    : `${Math.round(bytes / 1024).toLocaleString('de-DE')} KB`
})
const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
    : t('settings.aboutPage.never')
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.about') }}</h1>
    <UCard v-if="data" data-testid="about">
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt class="text-muted">{{ t('settings.aboutPage.version') }}</dt>
        <dd data-testid="about-version">{{ data.version }}</dd>
        <dt class="text-muted">{{ t('settings.aboutPage.schema') }}</dt>
        <dd class="truncate">{{ data.migration }}</dd>
        <dt class="text-muted">{{ t('settings.aboutPage.database') }}</dt>
        <dd data-testid="about-size">{{ size }}</dd>
      </dl>
    </UCard>
    <UCard v-if="data">
      <template #header>
        <h2 class="font-semibold">{{ t('settings.aboutPage.sources') }}</h2>
      </template>
      <p v-if="data.sources.length === 0" class="text-sm text-muted">
        {{ t('settings.aboutPage.noSources') }}
      </p>
      <ul v-else class="divide-y divide-default text-sm" data-testid="about-sources">
        <li
          v-for="source in data.sources"
          :key="source.source"
          class="flex flex-wrap items-center justify-between gap-2 py-2"
        >
          <span class="font-medium">{{ source.name }}</span>
          <span class="text-muted">
            {{ t('settings.aboutPage.lastFetch', { date: when(source.lastSuccessAt) }) }}
            <span v-if="source.lastError" class="block text-error">{{ source.lastError }}</span>
          </span>
        </li>
      </ul>
    </UCard>
  </section>
</template>
