<script setup lang="ts">
import type { RefreshSchedule } from '@finance/shared'

/** Settings › Daten (014 US1): automatic "Aktualisieren" of all sources. */
const { t } = useI18n()
const { settings, update } = useSettings()

const schedule = computed(() => settings.value.refreshSchedule)
const modes = computed(() => [
  { label: t('settings.refresh.off'), value: 'off' },
  { label: t('settings.refresh.daily'), value: 'daily' },
  { label: t('settings.refresh.interval'), value: 'interval' },
])
const hours = [1, 2, 3, 4, 6, 8, 12, 24].map((value) => ({
  label: t('settings.refresh.everyHours', { n: value }, value),
  value,
}))

function save(patch: Partial<RefreshSchedule>): void {
  void update({ refreshSchedule: { ...schedule.value, ...patch } })
}

function saveTime(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) save({ time: value })
}
</script>

<template>
  <UCard data-testid="refresh-schedule">
    <template #header>
      <h2 class="font-semibold">{{ t('settings.refresh.title') }}</h2>
      <p class="text-sm text-muted">{{ t('settings.refresh.hint') }}</p>
    </template>
    <div class="flex flex-wrap items-center gap-2">
      <USelect
        :model-value="schedule.mode"
        :items="modes"
        class="w-48"
        :aria-label="t('settings.refresh.title')"
        data-testid="refresh-mode"
        @update:model-value="save({ mode: $event as RefreshSchedule['mode'] })"
      />
      <UInput
        v-if="schedule.mode === 'daily'"
        type="time"
        :model-value="schedule.time"
        class="w-32"
        :aria-label="t('settings.refresh.time')"
        data-testid="refresh-time"
        @change="saveTime"
      />
      <USelect
        v-if="schedule.mode === 'interval'"
        :model-value="schedule.hours"
        :items="hours"
        class="w-48"
        :aria-label="t('settings.refresh.interval')"
        data-testid="refresh-hours"
        @update:model-value="save({ hours: Number($event) })"
      />
    </div>
  </UCard>
</template>
