<script setup lang="ts">
import { formatDate, formatPctSigned, type Period, type ReturnsResponse } from '@finance/shared'
import {
  VisAxis,
  VisCrosshair,
  VisGroupedBar,
  VisLine,
  VisTooltip,
  VisXYContainer,
} from '@unovis/vue'

/** Rendite as line, heatmap or yearly bars, plus the yearly table (US1). */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const view = ref<'line' | 'heatmap' | 'bars'>('line')
const period = ref<Period>('ALL')

const { data } = await useApi<ReturnsResponse>('/api/analysis/returns', {
  query: { period, accounts: accountsParam },
  default: () => ({ series: [], months: [], years: [] }),
})

type LinePoint = ReturnsResponse['series'][number] & { index: number }
const line = computed<LinePoint[]>(() =>
  (data.value?.series ?? []).map((point, index) => ({ ...point, index })),
)
type BarPoint = ReturnsResponse['years'][number] & { index: number }
const bars = computed<BarPoint[]>(() =>
  (data.value?.years ?? []).map((year, index) => ({ ...year, index })),
)
const hasData = computed(() => (data.value?.years.length ?? 0) > 0)

const lineX = (p: LinePoint) => p.index
const lineY = (p: LinePoint) => Number(p.twror) * 100
const barX = (p: BarPoint) => p.index
const barY = [(p: BarPoint) => Number(p.twror ?? 0) * 100]
const barColor = (p: BarPoint) =>
  Number(p.twror ?? 0) >= 0 ? 'var(--color-emerald-500)' : 'var(--color-rose-500)'

const tickDate = (index: number) => {
  const point = line.value[Math.round(index)]
  return point
    ? new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
        new Date(`${point.date}T00:00:00Z`),
      )
    : ''
}
const tickYear = (index: number) => String(bars.value[Math.round(index)]?.year ?? '')
const tickPct = (value: number) => `${value.toFixed(0)} %`
const lineTooltip = (p: LinePoint) =>
  `<div class="text-xs"><div class="font-medium">${formatDate(p.date)}</div><div>${t('analysis.returns.twror')}: ${formatPctSigned(Number(p.twror))}</div></div>`
const barTooltip = (p: BarPoint) =>
  `<div class="text-xs"><div class="font-medium">${p.year}</div><div>${t('analysis.returns.twror')}: ${p.twror === null ? '–' : formatPctSigned(Number(p.twror))}</div></div>`
</script>

<template>
  <UCard data-testid="returns-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('analysis.returns.title') }}</h2>
        <UTabs
          v-model="view"
          :items="[
            { label: t('analysis.returns.line'), value: 'line' },
            { label: t('analysis.returns.heatmap'), value: 'heatmap' },
            { label: t('analysis.returns.bars'), value: 'bars' },
          ]"
          :content="false"
          size="xs"
          data-testid="returns-view"
        />
      </div>
    </template>

    <EmptyState v-if="!hasData" :title="t('analysis.empty')" icon="i-lucide-chart-line" />
    <template v-else>
      <template v-if="view === 'line'">
        <PeriodTabs v-model="period" class="mb-3" />
        <ClientOnly>
          <VisXYContainer :data="line" :height="240" class="chart">
            <VisLine :x="lineX" :y="lineY" color="var(--ui-primary)" :line-width="2" />
            <VisAxis type="x" :tick-format="tickDate" :num-ticks="4" :grid-line="false" />
            <VisAxis type="y" :tick-format="tickPct" :num-ticks="4" />
            <VisCrosshair :template="lineTooltip" color="var(--ui-primary)" />
            <VisTooltip />
          </VisXYContainer>
          <template #fallback><USkeleton class="h-[240px] w-full" /></template>
        </ClientOnly>
      </template>
      <ReturnHeatmap v-else-if="view === 'heatmap'" :months="data!.months" :years="data!.years" />
      <ClientOnly v-else>
        <VisXYContainer :data="bars" :height="220" class="chart chart-hover">
          <VisGroupedBar :x="barX" :y="barY" :color="barColor" :rounded-corners="3" />
          <VisAxis
            type="x"
            :tick-format="tickYear"
            :tick-values="bars.map((bar) => bar.index)"
            :grid-line="false"
          />
          <VisAxis type="y" :tick-format="tickPct" :num-ticks="4" />
          <VisCrosshair :template="barTooltip" />
          <VisTooltip />
        </VisXYContainer>
        <template #fallback><USkeleton class="h-[220px] w-full" /></template>
      </ClientOnly>

      <h3 class="mt-6 mb-2 text-sm font-semibold">{{ t('analysis.returns.yearly') }}</h3>
      <YearlyTable :years="data!.years" />
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
