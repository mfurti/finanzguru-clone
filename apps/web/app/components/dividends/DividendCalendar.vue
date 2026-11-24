<script setup lang="ts">
import { type DividendCalendarEntry, formatDate } from '@finance/shared'

/**
 * Received and expected payments (US2): a list grouped by month, or a month
 * grid for one year like the reference's Dividendenkalender (003 US5, FR-016).
 */
const props = defineProps<{ entries: DividendCalendarEntry[] }>()
const emit = defineEmits<{
  edit: [entry: DividendCalendarEntry]
  remove: [entry: DividendCalendarEntry]
}>()
const { t } = useI18n()
const view = ref<'list' | 'grid'>('list')
const thisYear = new Date().getUTCFullYear()
const year = ref(thisYear)
/** Twelve cells of the selected year with their payments. */
const grid = computed(() =>
  Array.from({ length: 12 }, (_, m) => {
    const key = `${year.value}-${String(m + 1).padStart(2, '0')}`
    const entries = props.entries.filter((entry) => entry.date.startsWith(key))
    return {
      key,
      label: new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(
        new Date(`${key}-01T00:00:00Z`),
      ),
      entries,
      totalCents: entries.reduce((sum, e) => sum + e.cents, 0),
    }
  }),
)
const years = computed(() =>
  [...new Set([thisYear, ...props.entries.map((e) => Number(e.date.slice(0, 4)))])].sort(),
)

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
    <div class="flex flex-wrap items-center justify-between gap-2">
      <UFieldGroup size="xs">
        <UButton
          :variant="view === 'list' ? 'soft' : 'ghost'"
          color="neutral"
          icon="i-lucide-list"
          :label="t('dividends.viewList')"
          data-testid="calendar-view-list"
          @click="view = 'list'"
        />
        <UButton
          :variant="view === 'grid' ? 'soft' : 'ghost'"
          color="neutral"
          icon="i-lucide-calendar-days"
          :label="t('dividends.viewGrid')"
          data-testid="calendar-view-grid"
          @click="view = 'grid'"
        />
      </UFieldGroup>
      <USelect
        v-if="view === 'grid'"
        v-model="year"
        :items="years.map((y) => ({ label: String(y), value: y }))"
        size="xs"
        class="w-24"
        data-testid="calendar-year"
      />
    </div>
    <div
      v-if="view === 'grid'"
      class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="calendar-grid"
    >
      <div
        v-for="cell in grid"
        :key="cell.key"
        class="min-h-24 rounded-lg border border-default p-2 text-xs"
        :data-testid="`calendar-cell-${cell.key}`"
      >
        <div class="mb-1 flex items-center justify-between">
          <span class="font-medium">{{ cell.label }}</span>
          <Money v-if="cell.totalCents" :cents="cell.totalCents" class="text-muted" />
        </div>
        <ul class="space-y-1">
          <li
            v-for="entry in cell.entries"
            :key="`${entry.status}-${entry.id ?? entry.date}-${entry.instrumentId}`"
            class="flex items-center gap-1.5"
            :title="`${entry.name} · ${formatDate(entry.date)}`"
          >
            <Avatar :name="entry.name" size="sm" class="size-5! text-[0.55rem]!" />
            <Money :cents="entry.cents" :class="entry.status === 'expected' ? 'text-muted' : ''" />
            <span v-if="entry.status === 'expected'" class="text-muted">·</span>
          </li>
        </ul>
      </div>
    </div>
    <p v-else-if="months.length === 0" class="text-sm text-muted">{{ t('dividends.empty') }}</p>
    <section v-for="month in view === 'list' ? months : []" :key="month.key">
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
