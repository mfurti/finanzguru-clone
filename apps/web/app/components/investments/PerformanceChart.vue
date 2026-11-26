<script setup lang="ts">
import {
  formatDate,
  formatEur,
  formatEurCompact,
  formatPctSigned,
  type AssetClass,
  type ClassPerformanceResponse,
  type Period,
  type PerformanceResponse,
} from '@finance/shared'
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

/**
 * Investment value vs. invested capital (US4). Asset-class chips add one line per selected
 * class (005 US2, like the reference app): € view shows the class value, % view its
 * time-weighted return, which stays flat after a sale. Headline and table always show "Alle".
 */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const period = ref<Period>('1Y')
const unit = ref<'eur' | 'pct'>('eur')
const query = computed(() => ({ period: period.value, accounts: accountsParam.value }))

const { data } = await useApi<PerformanceResponse>('/api/investments/performance', {
  query,
  default: () => ({ valueCents: 0, gainCents: 0, gainPct: null, series: [] }),
})
const { data: classData } = await useApi<ClassPerformanceResponse>(
  '/api/investments/performance/classes',
  { query, default: () => ({ classes: [], series: [] }) },
)

/** Fixed color per class so a line keeps its color when chips change. */
const CLASS_COLORS: Record<AssetClass, string> = {
  stock: 'var(--color-sky-500)',
  etf: 'var(--color-violet-500)',
  fund: 'var(--color-amber-500)',
  bond: 'var(--color-teal-500)',
  crypto: 'var(--color-orange-500)',
  commodity: 'var(--color-yellow-600)',
  other: 'var(--color-slate-400)',
  cash: 'var(--color-lime-500)',
}
const CHIPS: AssetClass[] = ['stock', 'etf', 'fund', 'bond', 'crypto', 'commodity', 'other']
const held = computed(() => new Set(classData.value?.classes ?? []))
const selected = ref<AssetClass[]>([])
// Classes without holdings in the new range drop out of the selection.
watch(held, (classes) => {
  selected.value = selected.value.filter((assetClass) => classes.has(assetClass))
})
function toggle(assetClass: AssetClass): void {
  selected.value = selected.value.includes(assetClass)
    ? selected.value.filter((item) => item !== assetClass)
    : [...selected.value, assetClass]
}
const byDate = computed(
  () => new Map((classData.value?.series ?? []).map((day) => [day.date, day.byClass])),
)
/** Value (€) or return (%) of `assetClass` on the point's date; undefined leaves a gap. */
function classY(assetClass: AssetClass) {
  return (point: Point) => {
    const value = byDate.value.get(point.date)?.[assetClass]
    if (!value) return undefined
    if (unit.value === 'eur') return value.valueCents / 100
    return value.twrorPct === null ? undefined : Number(value.twrorPct) * 100
  }
}

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
  selected.value
    .map((assetClass) => {
      const y = classY(assetClass)(point)
      if (y === undefined) return ''
      const text = unit.value === 'eur' ? formatEur(Math.round(y * 100)) : formatPctSigned(y / 100)
      return `<div>${t(`assetClasses.${assetClass}`)}: ${text}</div>`
    })
    .join('') +
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
    <div v-if="hasData" class="mb-3 flex flex-wrap gap-1.5" data-testid="class-chips">
      <UButton
        size="xs"
        :variant="selected.length === 0 ? 'soft' : 'ghost'"
        color="neutral"
        :label="t('investments.classChips.all')"
        data-testid="class-chip-all"
        @click="selected = []"
      />
      <UButton
        v-for="assetClass in CHIPS"
        :key="assetClass"
        size="xs"
        :variant="selected.includes(assetClass) ? 'soft' : 'ghost'"
        color="neutral"
        :disabled="!held.has(assetClass)"
        :title="held.has(assetClass) ? undefined : t('investments.classChips.noHoldings')"
        :aria-pressed="selected.includes(assetClass)"
        :data-testid="`class-chip-${assetClass}`"
        @click="toggle(assetClass)"
      >
        <span
          class="size-2 rounded-full"
          :style="{ background: CLASS_COLORS[assetClass] }"
          aria-hidden="true"
        />
        {{ t(`assetClasses.${assetClass}`) }}
      </UButton>
    </div>
    <ul
      v-if="selected.length > 0"
      class="mb-2 flex flex-wrap gap-3 text-xs text-muted"
      data-testid="class-legend"
    >
      <li class="flex items-center gap-1">
        <span class="h-0.5 w-3 rounded" style="background: var(--color-emerald-500)" />
        {{ t('investments.classChips.all') }}
      </li>
      <li
        v-for="assetClass in selected"
        :key="assetClass"
        class="flex items-center gap-1"
        :data-testid="`class-legend-${assetClass}`"
      >
        <span class="h-0.5 w-3 rounded" :style="{ background: CLASS_COLORS[assetClass] }" />
        {{ t(`assetClasses.${assetClass}`) }}
      </li>
    </ul>
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
        <VisLine
          v-for="assetClass in selected"
          :key="`${assetClass}-${unit}`"
          :x="x"
          :y="classY(assetClass)"
          :color="CLASS_COLORS[assetClass]"
          :line-width="1.5"
        />
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
