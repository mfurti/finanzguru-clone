<script setup lang="ts">
import { type CashflowSummary, formatEur, formatEurCompact } from '@finance/shared'
import { GroupedBar } from '@unovis/ts'
import { VisAxis, VisCrosshair, VisGroupedBar, VisTooltip, VisXYContainer } from '@unovis/vue'

/**
 * 12 periods of income vs. expenses, styled like the reference: all bars are
 * dimmed, the period under the mouse is shown in full color, and the current
 * (selected) period is hatched. Clicking a bar jumps to that period.
 */
const props = defineProps<{ bars: CashflowSummary['bars'] }>()
const emit = defineEmits<{ select: [from: string] }>()
const { t } = useI18n()

type Bar = CashflowSummary['bars'][number] & { index: number }
const data = computed<Bar[]>(() => props.bars.map((bar, index) => ({ ...bar, index })))
const x = (bar: Bar) => bar.index
const y = [(bar: Bar) => bar.incomeCents / 100, (bar: Bar) => bar.expenseCents / 100]

const COLORS = ['var(--color-emerald-500)', 'var(--color-rose-500)'] as const
/** Unique pattern ids per chart instance (overview card and budget page). */
const uid = useId()
const hatch = (series: number) => `url(#hatch-${uid}-${series})`

/** Period under the mouse (crosshair), null when the pointer is outside. */
const hovered = ref<number | null>(null)
/** New accessor per hover state so Unovis re-renders the bar colors. */
const color = computed(() => {
  const active = hovered.value
  return (bar: Bar, series: number) => {
    if (bar.isCurrent) return hatch(series)
    const base = COLORS[series] ?? COLORS[0]
    return active === bar.index ? base : `color-mix(in oklab, ${base} 30%, transparent)`
  }
})
/** Nearest bar group to the pointer: the whole month column reacts, not only the bar. */
function onPointerMove(event: PointerEvent): void {
  const root = event.currentTarget as HTMLElement
  const groups = [...root.querySelectorAll<SVGGElement>("g[class$='-barGroup']")]
  let best: number | null = null
  let distance = Infinity
  groups.forEach((group, index) => {
    const box = group.getBoundingClientRect()
    const d = Math.abs(box.left + box.width / 2 - event.clientX)
    if (d < distance) {
      distance = d
      best = index
    }
  })
  const columnWidth =
    groups.length > 1
      ? Math.abs(groups[1]!.getBoundingClientRect().left - groups[0]!.getBoundingClientRect().left)
      : Infinity
  hovered.value = distance <= columnWidth / 2 ? best : null
}

const short = (label: string) => label.replace(/^(\w{3})\w*/, '$1')
const tick = (index: number) => short(data.value[Math.round(index)]?.label ?? '')
const tooltip = (bar: Bar) =>
  `<div class="text-xs"><div class="font-medium">${bar.label}</div><div>${t('budget.income')}: ${formatEur(bar.incomeCents)}</div><div>${t('budget.expenses')}: ${formatEur(-bar.expenseCents)}</div></div>`
const barEvents = { [GroupedBar.selectors.bar]: { click: (bar: Bar) => emit('select', bar.from) } }
</script>

<template>
  <div data-testid="cashflow-bars" @pointermove="onPointerMove" @pointerleave="hovered = null">
    <!-- Diagonal hatching for the current period, one pattern per series. -->
    <svg width="0" height="0" class="absolute" aria-hidden="true">
      <defs>
        <pattern
          v-for="(base, series) in COLORS"
          :id="`hatch-${uid}-${series}`"
          :key="series"
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
        >
          <path
            d="M 3 -3 L -3 3 M 6 0 L 0 6 M 9 3 L 3 9"
            fill="none"
            stroke-width="1.75"
            :style="{ stroke: base }"
          />
        </pattern>
      </defs>
    </svg>
    <div class="mb-2 flex gap-4 text-xs text-muted">
      <span class="flex items-center gap-1"
        ><span class="size-2.5 rounded-sm bg-emerald-500" />{{ t('budget.income') }}</span
      >
      <span class="flex items-center gap-1"
        ><span class="size-2.5 rounded-sm bg-rose-500" />{{ t('budget.expenses') }}</span
      >
    </div>
    <ClientOnly>
      <VisXYContainer :data="data" :height="200" class="chart" :padding="{ top: 8 }">
        <VisGroupedBar
          :x="x"
          :y="y"
          :color="color"
          :rounded-corners="3"
          :group-padding="0.35"
          :bar-padding="0.15"
          :group-max-width="26"
          :events="barEvents"
        />
        <VisAxis
          type="x"
          :tick-format="tick"
          :tick-values="data.map((bar) => bar.index)"
          :grid-line="false"
        />
        <VisAxis
          type="y"
          :tick-format="(v: number) => formatEurCompact(Math.round(v * 100))"
          :num-ticks="3"
        />
        <VisCrosshair
          :template="tooltip"
          color="transparent"
          stroke-color="transparent"
          :stroke-width="0"
        />
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
.chart :deep(path[class$='-bar']) {
  cursor: pointer;
  transition: fill 150ms ease;
}
</style>
