<script setup lang="ts">
/** Tiny trend line; fewer than two points draw a flat line. Decorative only. */
const props = withDefaults(defineProps<{ values: number[]; width?: number; height?: number }>(), {
  width: 96,
  height: 28,
})
const points = computed(() => {
  const values =
    props.values.length >= 2 ? props.values : [props.values[0] ?? 0, props.values[0] ?? 0]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = props.width / (values.length - 1)
  const pad = 2
  return values
    .map((value, i) => {
      const y =
        max === min ? props.height / 2 : pad + (1 - (value - min) / span) * (props.height - 2 * pad)
      return `${(i * step).toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
const rising = computed(() => (props.values.at(-1) ?? 0) >= (props.values[0] ?? 0))
</script>

<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
    class="block overflow-visible"
    data-testid="sparkline"
  >
    <polyline
      :points="points"
      fill="none"
      stroke-width="1.75"
      stroke-linejoin="round"
      stroke-linecap="round"
      :class="rising ? 'stroke-(--ui-success)' : 'stroke-(--ui-error)'"
    />
  </svg>
</template>
