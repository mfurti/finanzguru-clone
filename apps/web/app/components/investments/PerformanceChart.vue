<script setup lang="ts">
import {
  formatDate,
  formatEur,
  formatEurCompact,
  formatPctSigned,
  type Period,
  type PerformanceResponse,
} from '@finance/shared'
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

/** Investment value vs. invested capital (US4). */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const period = ref<Period>('1Y')
const unit = ref<'eur' | 'pct'>('eur')

const { data } = await useApi<PerformanceResponse>('/api/investments/performance', {
  query: { period, accounts: accountsParam },
  default: () => ({ valueCents: 0, gainCents: 0, gainPct: null, series: [] }),
})

type Point = PerformanceResponse['series'][number] & { index: number }
const points = computed<Point[]>(() =>
  (data.value?.series ?? []).map((point, index) => ({ ...point, index })),
)
const hasData = computed(() => points.value.length > 0)

/** "Vergleichen mit" (US5): benchmark return over the displayed range, % mode only. */
const benchmark = useBenchmark('investmentsBenchmark', () =>
  points.value.length > 0 ? { from: points.value[0]!.date, to: points.value.at(-1)!.date } : null,
)
const yBenchmark = (point: Point) => {
  const value = benchmark.byDate.value.get(point.date)
  return value === undefined ? undefined : value * 100
}
const showBenchmark = computed(() => unit.value === 'pct' && benchmark.byDate.value.size > 0)

const x = (point: Point) => point.index
const yValue = (point: Point) => point.valueCents / 100
const yInvested = (point: Point) => point.investedCents / 100
const yPct = (point: Point) =>
  point.investedCents > 0
    ? ((point.valueCents - point.investedCents) / point.investedCents) * 100
    : 0

const tickDate = (index: number) => {
  const point = points.value[Math.round(index)]
  return point
    ? new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(
        new Date(`${point.date}T00:00:00Z`),
      )
    : ''
}
const tickY = (value: number) =>
  unit.value === 'eur' ? formatEurCompact(Math.round(value * 100)) : `${value.toFixed(0)} %`
const tooltip = (point: Point) =>
  `<div class="text-xs"><div class="font-medium">${formatDate(point.date)}</div>` +
  (unit.value === 'eur'
    ? `<div>${t('investments.value')}: ${formatEur(point.valueCents)}</div><div>${t('investments.invested')}: ${formatEur(point.investedCents)}</div>`
    : `<div>${t('investments.gain')}: ${formatPctSigned(yPct(point) / 100)}</div>` +
      (showBenchmark.value && yBenchmark(point) !== undefined
        ? `<div>${benchmark.name.value}: ${formatPctSigned(yBenchmark(point)! / 100)}</div>`
        : '')) +
  '</div>'
</script>

<template>
  <UCard data-testid="performance-card">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="text-3xl font-semibold" data-testid="investments-total">
          <Money :cents="hasData ? data!.valueCents : null" />
        </div>
        <div class="flex items-center gap-2 text-sm">
          <Money :cents="hasData ? data!.gainCents : null" signed />
          <span class="text-muted">{{ t('investments.gain') }}</span>
        </div>
      </div>
      <UFieldGroup size="xs">
        <UButton
          :variant="unit === 'eur' ? 'soft' : 'ghost'"
          color="neutral"
          label="€"
          @click="unit = 'eur'"
        />
        <UButton
          :variant="unit === 'pct' ? 'soft' : 'ghost'"
          color="neutral"
          label="%"
          @click="unit = 'pct'"
        />
      </UFieldGroup>
    </div>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <PeriodTabs v-model="period" />
      <BenchmarkSelect
        v-if="unit === 'pct'"
        v-model="benchmark.selected.value"
        :benchmarks="benchmark.benchmarks.value ?? []"
        :stale="benchmark.series.value?.stale"
      />
    </div>
    <EmptyState v-if="!hasData" :title="t('investments.empty')" icon="i-lucide-chart-line" />
    <div
      v-if="showBenchmark"
      class="mb-2 flex flex-wrap gap-3 text-xs text-muted"
      data-testid="benchmark-legend"
    >
      <span class="flex items-center gap-1"
        ><span class="h-0.5 w-3 rounded" style="background: var(--color-emerald-500)" />{{
          t('investments.gain')
        }}</span
      >
      <span class="flex items-center gap-1"
        ><span class="h-0.5 w-3 rounded" style="background: var(--color-amber-500)" />{{
          benchmark.name.value
        }}</span
      >
    </div>
    <ClientOnly v-else>
      <VisXYContainer :data="points" :height="240" class="chart">
        <template v-if="unit === 'eur'">
          <VisLine :x="x" :y="yValue" color="var(--color-emerald-500)" :line-width="2" />
          <VisLine :x="x" :y="yInvested" color="var(--ui-text-muted)" :line-width="1.5" />
        </template>
        <template v-else>
          <VisLine :x="x" :y="yPct" color="var(--color-emerald-500)" :line-width="2" />
          <VisLine
            v-if="showBenchmark"
            :x="x"
            :y="yBenchmark"
            color="var(--color-amber-500)"
            :line-width="1.5"
            data-testid="benchmark-line"
          />
        </template>
        <VisAxis type="x" :tick-format="tickDate" :num-ticks="4" :grid-line="false" />
        <VisAxis type="y" :tick-format="tickY" :num-ticks="4" />
        <VisCrosshair :template="tooltip" />
        <VisTooltip />
      </VisXYContainer>
      <template #fallback><USkeleton class="h-[240px] w-full" /></template>
    </ClientOnly>
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
