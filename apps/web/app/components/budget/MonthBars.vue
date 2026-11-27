<script setup lang="ts">
import { formatEur, formatEurCompact } from '~/utils/privacy'

/**
 * Monthly bars for one or two series (category history, budget vs. spending;
 * 003 US3/US4). Same look as the cash-flow bars: all bars dimmed, the hovered
 * month in full color, the current month hatched. `null` values leave a gap
 * (e.g. months before a budget existed).
 */
const props = defineProps<{
  months: string[]
  series: { label: string; color: string; values: (number | null)[] }[]
  currentIndex?: number
  height?: number
}>()
const height = computed(() => props.height ?? 220)
const uid = useId()

const root = useTemplateRef<HTMLDivElement>('root')
const width = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!root.value) return
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(280, Math.round(entry!.contentRect.width))
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

const PAD = { top: 8, right: 8, bottom: 24, left: 56 }
const max = computed(() =>
  Math.max(1, ...props.series.flatMap((s) => s.values.map((v) => Math.abs(v ?? 0)))),
)
const plotW = computed(() => width.value - PAD.left - PAD.right)
const plotH = computed(() => height.value - PAD.top - PAD.bottom)
const slot = computed(() => plotW.value / Math.max(1, props.months.length))
const barW = computed(() => Math.min(22, (slot.value * 0.7) / Math.max(1, props.series.length)))
const bars = computed(() =>
  props.months.flatMap((month, i) =>
    props.series.map((serie, s) => {
      const value = serie.values[i]
      const h =
        value === null || value === undefined ? 0 : (Math.abs(value) / max.value) * plotH.value
      const groupW = barW.value * props.series.length + (props.series.length - 1) * 3
      return {
        key: `${month}-${s}`,
        index: i,
        series: s,
        x: PAD.left + i * slot.value + (slot.value - groupW) / 2 + s * (barW.value + 3),
        y: PAD.top + plotH.value - h,
        h,
        empty: value === null || value === undefined,
        color: serie.color,
      }
    }),
  ),
)
const ticks = computed(() =>
  [0, 0.5, 1].map((f) => ({ y: PAD.top + plotH.value * (1 - f), value: max.value * f })),
)
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  )
const hovered = ref<number | null>(null)
function onMove(event: PointerEvent): void {
  const box = root.value!.getBoundingClientRect()
  const x = event.clientX - box.left - PAD.left
  const i = Math.floor(x / slot.value)
  hovered.value = i >= 0 && i < props.months.length ? i : null
}
const fill = (bar: { index: number; series: number; color: string }) =>
  bar.index === props.currentIndex
    ? `url(#mb-hatch-${uid}-${bar.series})`
    : hovered.value === bar.index
      ? bar.color
      : `color-mix(in oklab, ${bar.color} 35%, transparent)`
</script>

<template>
  <div ref="root" class="relative" data-testid="month-bars" @pointerleave="hovered = null">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="block"
      role="img"
      :aria-label="series.map((s) => s.label).join(', ')"
      @pointermove="onMove"
    >
      <defs>
        <pattern
          v-for="(serie, s) in series"
          :id="`mb-hatch-${uid}-${s}`"
          :key="s"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect
            width="6"
            height="6"
            :fill="`color-mix(in oklab, ${serie.color} 35%, transparent)`"
          />
          <line x1="0" y1="0" x2="0" y2="6" :stroke="serie.color" stroke-width="3" />
        </pattern>
      </defs>
      <g class="text-[10px]" fill="var(--ui-text-muted)">
        <g v-for="tick in ticks" :key="tick.y">
          <line
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="tick.y"
            :y2="tick.y"
            stroke="var(--ui-border)"
            stroke-dasharray="2 3"
          />
          <text :x="PAD.left - 6" :y="tick.y" text-anchor="end" dominant-baseline="middle">
            {{ formatEurCompact(Math.round(tick.value)) }}
          </text>
        </g>
        <text
          v-for="(month, i) in months"
          :key="month"
          :x="PAD.left + i * slot + slot / 2"
          :y="height - 6"
          text-anchor="middle"
        >
          {{ monthLabel(month) }}
        </text>
      </g>
      <rect
        v-for="bar in bars.filter((b) => !b.empty)"
        :key="bar.key"
        :x="bar.x"
        :y="bar.y"
        :width="barW"
        :height="Math.max(1, bar.h)"
        rx="3"
        :fill="fill(bar)"
        class="transition-[fill] duration-150"
      />
    </svg>
    <div
      v-if="hovered !== null"
      class="pointer-events-none absolute top-0 z-10 rounded-md border border-default bg-elevated px-2 py-1 text-xs whitespace-nowrap shadow-sm"
      :style="{ left: `${Math.min(width - 160, PAD.left + hovered * slot + slot)}px` }"
      data-testid="month-bars-tooltip"
    >
      <div class="font-medium">
        {{ monthLabel(months[hovered]!) }} {{ months[hovered]!.slice(0, 4) }}
      </div>
      <div v-for="serie in series" :key="serie.label" class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :style="{ backgroundColor: serie.color }" />
        {{ serie.label }}:
        {{ serie.values[hovered] === null ? '–' : formatEur(serie.values[hovered]!) }}
      </div>
    </div>
  </div>
</template>
