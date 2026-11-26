<script setup lang="ts">
import {
  type AccountDto,
  type CompareResponse,
  formatDate,
  formatPctSigned,
  type Period,
} from '@finance/shared'
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

/** Portfoliovergleich: TWROR of several depots from a common start (US1). */
const { t } = useI18n()
const period = ref<Period>('1Y')

const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})
const depots = computed(() => (accounts.value ?? []).filter((a) => a.type === 'depot'))
const selected = ref<string[]>(depots.value.map((d) => d.id))
const depotItems = computed(() => depots.value.map((d) => ({ label: d.name, value: d.id })))

const { data } = await useApi<CompareResponse>('/api/analysis/compare', {
  query: computed(() => ({
    period: period.value,
    accounts: selected.value.length > 0 ? selected.value.join(',') : undefined,
  })),
  default: () => ({ series: [] }),
})

/** One row per date with a value per depot (series share the same dates). */
type Row = { index: number; date: string; values: (number | undefined)[] }
const rows = computed<Row[]>(() => {
  const series = data.value?.series ?? []
  const first = series[0]
  if (!first) return []
  return first.points.map((point, index) => ({
    index,
    date: point.date,
    values: series.map((s) => {
      const match = s.points[index]
      return match ? Number(match.twror) * 100 : undefined
    }),
  }))
})
const ys = computed(() => (data.value?.series ?? []).map((_, i) => (row: Row) => row.values[i]))
const colors = computed(() => (data.value?.series ?? []).map((_, i) => paletteColor(i)))
const x = (row: Row) => row.index
const tickDate = (index: number) => {
  const row = rows.value[Math.round(index)]
  return row
    ? new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
        new Date(`${row.date}T00:00:00Z`),
      )
    : ''
}
const tooltip = (row: Row) =>
  `<div class="text-xs"><div class="font-medium">${formatDate(row.date)}</div>${(
    data.value?.series ?? []
  )
    .map(
      (s, i) =>
        `<div class="flex justify-between gap-4"><span>${s.name}</span><span>${row.values[i] === undefined ? '–' : formatPctSigned(row.values[i]! / 100)}</span></div>`,
    )
    .join('')}</div>`
</script>

<template>
  <UCard data-testid="compare-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('analysis.compare.title') }}</h2>
        <USelectMenu
          v-model="selected"
          :items="depotItems"
          value-key="value"
          multiple
          :placeholder="t('analysis.compare.select')"
          class="w-56"
          data-testid="compare-select"
        />
      </div>
    </template>
    <PeriodTabs v-model="period" class="mb-3" />
    <p v-if="selected.length < 2" class="mb-2 text-xs text-muted">
      {{ t('analysis.compare.empty') }}
    </p>
    <EmptyState v-if="rows.length === 0" :title="t('analysis.empty')" icon="i-lucide-chart-line" />
    <template v-else>
      <div class="mb-2 flex flex-wrap gap-3 text-xs text-muted">
        <span v-for="(s, i) in data!.series" :key="s.accountId" class="flex items-center gap-1">
          <span class="size-2.5 rounded-sm" :style="{ background: colors[i] }" />{{ s.name }}
        </span>
      </div>
      <ClientOnly>
        <VisXYContainer :data="rows" :height="220" class="chart">
          <VisLine :x="x" :y="ys" :color="colors" :line-width="2" />
          <VisAxis type="x" :tick-format="tickDate" :num-ticks="4" :grid-line="false" />
          <VisAxis type="y" :tick-format="(v: number) => `${v.toFixed(0)} %`" :num-ticks="4" />
          <VisCrosshair :template="tooltip" />
          <VisTooltip />
        </VisXYContainer>
        <template #fallback><USkeleton class="h-[220px] w-full" /></template>
      </ClientOnly>
    </template>
  </UCard>
</template>

<style scoped>
.chart {
  --vis-axis-tick-label-color: var(--ui-text-muted);
  --vis-axis-grid-color: var(--ui-border);
  --vis-tooltip-background-color: var(--ui-bg-elevated);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text);
}
</style>
