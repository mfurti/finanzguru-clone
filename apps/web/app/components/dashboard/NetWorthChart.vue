<script setup lang="ts">
import {
  formatDate,
  formatEur,
  formatEurCompact,
  formatPctSigned,
  type NetWorthPoint,
  type NetWorthResponse,
  type Period,
} from '@finance/shared'
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

/** Net-worth chart with total, gain, Vermögen/Rendite switch and period tabs (US1). */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()

const period = ref<Period>('1Y')
const mode = ref<'value' | 'return'>('value')

const { data, status } = await useApi<NetWorthResponse>('/api/overview/net-worth', {
  query: { period, mode, accounts: accountsParam },
  default: () => ({ totalCents: 0, gainCents: 0, gainPct: null, series: [] }),
})

const series = computed(() => data.value?.series ?? [])
const hasData = computed(() => series.value.length > 0)

type Point = NetWorthPoint & { index: number }
const points = computed<Point[]>(() => series.value.map((point, index) => ({ ...point, index })))

const x = (point: Point) => point.index
const yValue = (point: Point) => point.valueCents / 100
const yInvested = (point: Point) => point.investedCents / 100
const yReturn = (point: Point) => (point.returnPct === null ? 0 : Number(point.returnPct) * 100)

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
  mode.value === 'value' ? formatEurCompact(Math.round(value * 100)) : `${value.toFixed(0)} %`

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
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <UTabs
        v-model="mode"
        :items="[
          { label: t('overview.netWorth.tabValue'), value: 'value' },
          { label: t('overview.netWorth.tabReturn'), value: 'return' },
        ]"
        :content="false"
        size="sm"
      />
    </div>
    <PeriodTabs v-model="period" class="mb-3" />

    <div class="mb-4 flex flex-wrap items-end gap-x-6 gap-y-1">
      <div>
        <div class="text-3xl font-semibold" data-testid="networth-total">
          <Money :cents="hasData ? data!.totalCents : null" />
        </div>
        <div class="text-xs text-muted">{{ t('overview.netWorth.total') }}</div>
      </div>
      <div>
        <div class="text-lg font-medium">
          <Money :cents="hasData ? data!.gainCents : null" signed />
        </div>
        <div class="text-xs text-muted">{{ t('overview.netWorth.gain') }}</div>
      </div>
    </div>

    <EmptyState
      v-if="status !== 'pending' && !hasData"
      :title="t('overview.empty.title')"
      :description="t('overview.empty.description')"
      icon="i-lucide-chart-area"
      :action-label="t('overview.empty.action')"
      action-to="/settings/sources"
    />
    <ClientOnly v-else>
      <VisXYContainer :data="points" :height="260" class="networth-chart">
        <template v-if="mode === 'value'">
          <VisArea :x="x" :y="yValue" color="var(--ui-primary)" :opacity="0.15" />
          <VisLine :x="x" :y="yValue" color="var(--ui-primary)" :line-width="2" />
          <VisLine :x="x" :y="yInvested" color="var(--ui-text-muted)" :line-width="1.5" />
        </template>
        <template v-else>
          <VisLine :x="x" :y="yReturn" color="var(--ui-primary)" :line-width="2" />
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
