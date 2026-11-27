<script setup lang="ts">
import { type DividendSummary, formatEur, formatEurCompact } from '@finance/shared'
import { VisAxis, VisCrosshair, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue'

/** Dividend income per year: bar chart and table with change to the previous year (US2). */
const props = defineProps<{ years: DividendSummary['years'] }>()
const { t } = useI18n()

type Bar = DividendSummary['years'][number] & { index: number }
const bars = computed<Bar[]>(() => props.years.map((year, index) => ({ ...year, index })))
const rows = computed(() => [...props.years].sort((a, b) => b.year - a.year))
const x = (bar: Bar) => bar.index
const y = [(bar: Bar) => bar.cents / 100]
const tick = (index: number) => String(bars.value[Math.round(index)]?.year ?? '')
const tooltip = (bar: Bar) =>
  `<div class="text-xs"><div class="font-medium">${bar.year}</div><div>${formatEur(bar.cents)}</div></div>`
</script>

<template>
  <div data-testid="dividend-history">
    <ClientOnly>
      <VisXYContainer :data="bars" :height="200" class="chart chart-hover">
        <VisGroupedBar :x="x" :y="y" color="var(--ui-primary)" :rounded-corners="3" />
        <VisAxis
          type="x"
          :tick-format="tick"
          :tick-values="bars.map((bar) => bar.index)"
          :grid-line="false"
        />
        <VisAxis
          type="y"
          :tick-format="(v: number) => formatEurCompact(Math.round(v * 100))"
          :num-ticks="3"
        />
        <VisCrosshair :duration="0" :template="tooltip" />
        <VisTooltip />
      </VisXYContainer>
      <template #fallback><USkeleton class="h-[200px] w-full" /></template>
    </ClientOnly>
    <table class="mt-4 w-full text-sm">
      <thead>
        <tr class="border-b border-default text-left text-xs text-muted">
          <th class="py-2 font-medium">{{ t('dividends.year') }}</th>
          <th class="py-2 text-right font-medium">{{ t('dividends.amount') }}</th>
          <th class="py-2 text-right font-medium">{{ t('dividends.change') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="row in rows" :key="row.year" class="row-hover">
          <td class="py-2">{{ row.year }}</td>
          <td class="py-2 text-right"><Money :cents="row.cents" /></td>
          <td class="py-2 text-right"><Percent :value="row.changePct" signed /></td>
        </tr>
      </tbody>
    </table>
  </div>
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
