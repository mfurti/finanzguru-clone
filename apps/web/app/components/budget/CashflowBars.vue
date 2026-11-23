<script setup lang="ts">
import { type CashflowSummary, formatEur, formatEurCompact } from '@finance/shared'
import { GroupedBar } from '@unovis/ts'
import { VisAxis, VisCrosshair, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue'

/** 12 periods of income vs. expenses; the current period is drawn lighter. */
const props = defineProps<{ bars: CashflowSummary['bars'] }>()
const emit = defineEmits<{ select: [from: string] }>()
const { t } = useI18n()

type Bar = CashflowSummary['bars'][number] & { index: number }
const data = computed<Bar[]>(() => props.bars.map((bar, index) => ({ ...bar, index })))
const x = (bar: Bar) => bar.index
const y = [(bar: Bar) => bar.incomeCents / 100, (bar: Bar) => bar.expenseCents / 100]
const color = (_: Bar, index: number) =>
  index === 0 ? 'var(--color-emerald-500)' : 'var(--color-rose-500)'
const short = (label: string) => label.replace(/^(\w{3})\w*/, '$1')
const tick = (index: number) => short(data.value[Math.round(index)]?.label ?? '')
const tooltip = (bar: Bar) =>
  `<div class="text-xs"><div class="font-medium">${bar.label}</div><div>${t('budget.income')}: ${formatEur(bar.incomeCents)}</div><div>${t('budget.expenses')}: ${formatEur(-bar.expenseCents)}</div></div>`
/** Clicking a bar jumps to that period. */
const barEvents = { [GroupedBar.selectors.bar]: { click: (bar: Bar) => emit('select', bar.from) } }
</script>

<template>
  <div data-testid="cashflow-bars">
    <div class="mb-2 flex gap-4 text-xs text-muted">
      <span class="flex items-center gap-1"
        ><span class="size-2.5 rounded-sm bg-emerald-500" />{{ t('budget.income') }}</span
      >
      <span class="flex items-center gap-1"
        ><span class="size-2.5 rounded-sm bg-rose-500" />{{ t('budget.expenses') }}</span
      >
    </div>
    <ClientOnly>
      <VisXYContainer :data="data" :height="200" class="chart chart-hover" :padding="{ top: 8 }">
        <VisGroupedBar
          :x="x"
          :y="y"
          :color="color"
          :rounded-corners="3"
          :group-padding="0.2"
          :bar-padding="0.1"
          :events="barEvents"
        />
        <VisAxis type="x" :tick-format="tick" :num-ticks="data.length" :grid-line="false" />
        <VisAxis
          type="y"
          :tick-format="(v: number) => formatEurCompact(Math.round(v * 100))"
          :num-ticks="3"
        />
        <VisCrosshair :template="tooltip" />
        <VisTooltip />
      </VisXYContainer>
      <template #fallback><USkeleton class="h-[200px] w-full" /></template>
    </ClientOnly>
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
