<script setup lang="ts">
import { type DividendCalendarEntry, formatDate } from '@finance/shared'

/** Received and expected payments grouped by month (US2). */
const props = defineProps<{ entries: DividendCalendarEntry[] }>()
const emit = defineEmits<{
  edit: [entry: DividendCalendarEntry]
  remove: [entry: DividendCalendarEntry]
}>()
const { t } = useI18n()

const months = computed(() => {
  const groups = new Map<string, DividendCalendarEntry[]>()
  for (const entry of props.entries) {
    const key = entry.date.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), entry])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, entries]) => ({
      key,
      label: new Intl.DateTimeFormat('de-DE', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${key}-01T00:00:00Z`)),
      entries,
      totalCents: entries.reduce((sum, e) => sum + e.cents, 0),
    }))
})
</script>

<template>
  <div class="space-y-4" data-testid="dividend-calendar">
    <p v-if="months.length === 0" class="text-sm text-muted">{{ t('dividends.empty') }}</p>
    <section v-for="month in months" :key="month.key">
      <div class="mb-1 flex items-center justify-between text-sm">
        <h3 class="font-medium">{{ month.label }}</h3>
        <Money :cents="month.totalCents" class="text-muted" />
      </div>
      <ul class="divide-y divide-default text-sm">
        <li
          v-for="entry in month.entries"
          :key="`${entry.status}-${entry.id ?? entry.date}-${entry.instrumentId}`"
          class="row-hover flex items-center justify-between gap-3 py-2"
          :data-testid="`calendar-${entry.status}`"
        >
          <span class="min-w-0">
            <span class="block truncate">{{ entry.name }}</span>
            <span class="text-xs text-muted">{{ formatDate(entry.date) }}</span>
          </span>
          <span class="flex shrink-0 items-center gap-2">
            <UBadge
              :color="entry.status === 'received' ? 'success' : 'neutral'"
              variant="soft"
              size="sm"
            >
              {{ t(`dividends.${entry.status}`) }}
            </UBadge>
            <Money :cents="entry.cents" />
            <template v-if="entry.id">
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="t('common.edit')"
                @click="emit('edit', entry)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="t('common.delete')"
                data-testid="expected-delete"
                @click="emit('remove', entry)"
              />
            </template>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
