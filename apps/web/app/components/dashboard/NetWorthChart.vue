<script setup lang="ts">
import {
  formatDate,
  formatEur,
  formatPctSigned,
  type NetWorthPoint,
  type NetWorthResponse,
  type ChartSettings,
  type Period,
} from '@finance/shared'
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

/**
 * Net-worth chart with total, gain, Vermögen/Rendite switch and period tabs (US1); header row,
 * ⓘ texts, line without area and compact axis like the reference (007 R6).
 */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()

const period = ref<Period>('1Y')
const mode = ref<'value' | 'return'>('value')

/** Custom range from the calendar (003 US6); overrides the period tabs while set. */
const range = ref<{ from: string; to: string } | null>(null)
const query = computed(() => ({
  period: period.value,
  mode: mode.value,
  accounts: accountsParam.value,
  ...(range.value ?? {}),
}))
const { data, status } = await useApi<NetWorthResponse>('/api/overview/net-worth', {
  query,
  default: () => ({ totalCents: 0, gainCents: 0, gainPct: null, series: [] }),
})

const series = computed(() => data.value?.series ?? [])

/** ⋮ menu: "Investiertes Kapital" line, remembered in the chart settings (FR-010). */
const { data: chartSettings } = useApi<ChartSettings>('/api/settings/charts', {
  key: 'chart-settings',
})
const showInvested = computed(() => chartSettings.value?.networthShowInvested !== false)
function toggleInvested(on: boolean): void {
  const next = {
    networthBenchmark: chartSettings.value?.networthBenchmark ?? null,
    investmentsBenchmark: chartSettings.value?.investmentsBenchmark ?? null,
    networthShowInvested: on,
  }
  chartSettings.value = next
  void apiFetch('/api/settings/charts', { method: 'PUT', body: next })
}
const menuItems = computed(() => [
  [
    {
      label: t('refine.investedCapital'),
      type: 'checkbox' as const,
      checked: showInvested.value,
      onUpdateChecked: toggleInvested,
      onSelect: (event: Event) => event.preventDefault(),
    },
  ],
])
const hasData = computed(() => series.value.length > 0)

type Point = NetWorthPoint & { index: number }
const points = computed<Point[]>(() => series.value.map((point, index) => ({ ...point, index })))

const x = (point: Point) => point.index
const yValue = (point: Point) => point.valueCents / 100
const yInvested = (point: Point) => point.investedCents / 100
const yReturn = (point: Point) => (point.returnPct === null ? 0 : Number(point.returnPct) * 100)

/** "Vergleichen mit" (US5): benchmark return over the displayed range, Rendite mode only. */
const benchmark = useBenchmark('networthBenchmark', () =>
  series.value.length > 0 ? { from: series.value[0]!.date, to: series.value.at(-1)!.date } : null,
)
const yBenchmark = (point: Point) => {
  const value = benchmark.byDate.value.get(point.date)
  return value === undefined ? undefined : value * 100
}
const showBenchmark = computed(() => mode.value === 'return' && benchmark.byDate.value.size > 0)

const tickDate = (index: number) => {
  const point = series.value[Math.round(index)]
  if (!point) return ''
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${point.date}T00:00:00Z`))
}
const tickY = (value: number) =>
  mode.value === 'value' ? compactEur(Math.round(value * 100)) : `${value.toFixed(0)} %`

const tooltip = (point: Point) => {
  const rows =
    mode.value === 'value'
      ? [
          [t('overview.netWorth.value'), formatEur(point.valueCents)],
          [t('overview.netWorth.invested'), formatEur(point.investedCents)],
          [t('overview.netWorth.cash'), formatEur(point.cashCents)],
        ]
      : [
          [
            t('overview.netWorth.return'),
            point.returnPct === null ? '–' : formatPctSigned(Number(point.returnPct)),
          ],
          ...(showBenchmark.value && yBenchmark(point) !== undefined
            ? [[benchmark.name.value ?? '', formatPctSigned(yBenchmark(point)! / 100)]]
            : []),
        ]
  return `<div class="text-xs"><div class="mb-1 font-medium">${formatDate(point.date)}</div>${rows
    .map(
      ([label, value]) =>
        `<div class="flex justify-between gap-4"><span>${label}</span><span class="tabular-nums">${value}</span></div>`,
    )
    .join('')}</div>`
}
</script>

<template>
  <UCard data-testid="networth-card">
    <div
      class="mb-4 flex flex-wrap items-center justify-between gap-2"
      data-testid="networth-header"
    >
      <UTabs
        v-model="mode"
        :items="[
          { label: t('overview.netWorth.tabValue'), value: 'value' },
          { label: t('overview.netWorth.tabReturn'), value: 'return' },
        ]"
        :content="false"
        size="sm"
      />
      <div class="flex flex-wrap items-center gap-1">
        <PeriodTabs v-model="period" :inactive="!!range" @pick="range = null" />
        <DateRangePicker v-model="range" />
        <UDropdownMenu :items="menuItems" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="t('refine.chartMenu')"
            data-testid="networth-menu"
          />
        </UDropdownMenu>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div class="flex flex-wrap items-end gap-x-6 gap-y-1">
        <div>
          <div class="text-3xl font-semibold" data-testid="networth-total">
            <Money :cents="hasData ? data!.totalCents : null" animate />
          </div>
          <div class="flex items-center gap-1 text-xs text-muted">
            {{ t('overview.netWorth.total') }}
            <InfoTooltip :text="t('info.netWorth')" />
          </div>
        </div>
        <div>
          <div class="text-lg font-medium">
            <Money :cents="hasData ? data!.gainCents : null" signed animate />
          </div>
          <div class="flex items-center gap-1 text-xs text-muted">
            {{ t('overview.netWorth.gain') }}
            <InfoTooltip :text="t('info.gain')" />
          </div>
        </div>
      </div>
      <BenchmarkSelect
        v-if="mode === 'return'"
        v-model="benchmark.selected.value"
        :benchmarks="benchmark.benchmarks.value ?? []"
        :stale="benchmark.series.value?.stale"
      />
    </div>

    <EmptyState
      v-if="status !== 'pending' && !hasData"
      :title="t('overview.empty.title')"
      :description="t('overview.empty.description')"
      icon="i-lucide-chart-area"
      :action-label="t('overview.empty.action')"
      action-to="/settings/sources"
    />
    <div
      v-if="showBenchmark"
      class="mb-2 flex flex-wrap gap-3 text-xs text-muted"
      data-testid="benchmark-legend"
    >
      <span class="flex items-center gap-1"
        ><span class="h-0.5 w-3 rounded" style="background: var(--ui-primary)" />{{
          t('overview.netWorth.return')
        }}</span
      >
      <span class="flex items-center gap-1"
        ><span class="h-0.5 w-3 rounded" style="background: var(--color-amber-500)" />{{
          benchmark.name.value
        }}</span
      >
    </div>
    <ClientOnly v-else>
      <VisXYContainer :data="points" :height="260" class="networth-chart">
        <template v-if="mode === 'value'">
          <VisLine :x="x" :y="yValue" color="var(--ui-primary)" :line-width="2" />
          <VisLine
            v-if="showInvested"
            :x="x"
            :y="yInvested"
            color="var(--ui-text-muted)"
            :line-width="1.5"
            data-testid="invested-line"
          />
        </template>
        <template v-else>
          <VisLine :x="x" :y="yReturn" color="var(--ui-primary)" :line-width="2" />
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
        <VisCrosshair :template="tooltip" color="var(--ui-primary)" />
        <VisTooltip />
      </VisXYContainer>
      <template #fallback>
        <USkeleton class="h-[260px] w-full" />
      </template>
    </ClientOnly>
  </UCard>
</template>

<style scoped>
.networth-chart {
  --vis-axis-tick-label-color: var(--ui-text-muted);
  --vis-axis-grid-color: var(--ui-border);
  --vis-tooltip-background-color: var(--ui-bg-elevated);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text);
}
</style>
