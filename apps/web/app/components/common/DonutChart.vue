<script setup lang="ts">
/**
 * Donut chart with the reference tool's motion: the ring sweeps in clockwise
 * from 12 o'clock, a hovered slice gets brighter with a translucent halo, and
 * the center slot receives the hovered item (amount and name instead of the
 * total). Slices are separated by a thin gap in the card color. Hover state is
 * a v-model so a list next to the chart can drive it too.
 */
export interface DonutItem {
  key: string
  value: number
  color: string
  label: string
}

const props = withDefaults(
  defineProps<{ items: DonutItem[]; size?: number; thickness?: number; duration?: number }>(),
  { size: 176, thickness: 22, duration: 900 },
)
const hovered = defineModel<string | null>('hovered', { default: null })
const emit = defineEmits<{ select: [key: string] }>()
defineSlots<{ center(props: { item: DonutItem | null }): unknown }>()

const HALO = 8
const box = computed(() => props.size + HALO * 2)
const center = computed(() => box.value / 2)
const outer = computed(() => props.size / 2)
const inner = computed(() => outer.value - props.thickness)

const visible = computed(() => props.items.filter((item) => item.value > 0))
const total = computed(() => visible.value.reduce((sum, item) => sum + item.value, 0))

/** 0 → 1 while the ring sweeps in; restarts when the data changes. */
const progress = ref(1)
let frame = 0
function sweep(): void {
  if (import.meta.server) return
  cancelAnimationFrame(frame)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    progress.value = 1
    return
  }
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / props.duration)
    progress.value = 1 - (1 - t) ** 3
    if (t < 1) frame = requestAnimationFrame(step)
  }
  progress.value = 0
  frame = requestAnimationFrame(step)
}
onMounted(sweep)
watch(
  () => visible.value.map((item) => `${item.key}:${item.value}`).join('|'),
  () => sweep(),
)
onBeforeUnmount(() => cancelAnimationFrame(frame))

const point = (radius: number, angle: number) => {
  const a = angle - Math.PI / 2
  return `${center.value + radius * Math.cos(a)} ${center.value + radius * Math.sin(a)}`
}
/** Ring segment between two angles (radians, clockwise from 12 o'clock). */
function ringPath(r0: number, r1: number, a0: number, a1: number): string {
  const span = Math.min(a1 - a0, Math.PI * 2 - 1e-4)
  if (span <= 0) return ''
  const end = a0 + span
  const large = span > Math.PI ? 1 : 0
  return [
    `M ${point(r1, a0)}`,
    `A ${r1} ${r1} 0 ${large} 1 ${point(r1, end)}`,
    `L ${point(r0, end)}`,
    `A ${r0} ${r0} 0 ${large} 0 ${point(r0, a0)}`,
    'Z',
  ].join(' ')
}

const slices = computed(() => {
  let angle = 0
  const sweepTo = Math.PI * 2 * progress.value
  return visible.value.map((item) => {
    const share = total.value ? item.value / total.value : 0
    const a0 = Math.min(angle, sweepTo)
    angle += share * Math.PI * 2
    const a1 = Math.min(angle, sweepTo)
    return {
      item,
      share,
      path: ringPath(inner.value, outer.value, a0, a1),
      halo: ringPath(outer.value, outer.value + HALO, a0, a1),
    }
  })
})
const hoveredItem = computed(() => visible.value.find((item) => item.key === hovered.value) ?? null)
const ariaLabel = computed(() =>
  visible.value
    .map((item) => `${item.label}: ${Math.round((item.value / (total.value || 1)) * 1000) / 10} %`)
    .join(', '),
)
</script>

<template>
  <div class="relative shrink-0" :style="{ width: `${box}px`, height: `${box}px` }">
    <svg
      :viewBox="`0 0 ${box} ${box}`"
      :width="box"
      :height="box"
      role="img"
      :aria-label="ariaLabel"
      class="donut"
      data-testid="donut-chart"
    >
      <g v-for="slice in slices" :key="slice.item.key">
        <path
          :d="slice.halo"
          :fill="slice.item.color"
          class="donut-halo"
          :class="{ 'is-active': hovered === slice.item.key }"
        />
        <path
          :d="slice.path"
          :fill="slice.item.color"
          class="donut-slice"
          :class="{ 'is-active': hovered === slice.item.key }"
          data-testid="donut-slice"
          :data-key="slice.item.key"
          @mouseenter="hovered = slice.item.key"
          @mouseleave="hovered = null"
          @click="emit('select', slice.item.key)"
        >
          <title>{{ slice.item.label }}</title>
        </path>
      </g>
    </svg>
    <div
      class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
    >
      <slot name="center" :item="hoveredItem" />
    </div>
  </div>
</template>

<style scoped>
.donut-slice {
  cursor: pointer;
  stroke: var(--ui-bg);
  stroke-width: 1.5px;
  transition: filter 150ms ease;
}
.donut-slice.is-active {
  filter: brightness(1.15);
}
.donut-halo {
  pointer-events: none;
  opacity: 0;
  transition: opacity 150ms ease;
}
.donut-halo.is-active {
  opacity: 0.25;
}
@media (prefers-reduced-motion: reduce) {
  .donut-slice,
  .donut-halo {
    transition: none;
  }
}
</style>
