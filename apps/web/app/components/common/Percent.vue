<script setup lang="ts">
import { formatPct, formatPctSigned, signTone } from '@finance/shared'

/** Ratio (0.0815 = 8,15 %) as decimal string or number; `null` renders a dash. */
const props = withDefaults(
  defineProps<{ value: number | string | null | undefined; signed?: boolean; colored?: boolean }>(),
  { signed: false, colored: undefined },
)

const ratio = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') return null
  const value = Number(props.value)
  return Number.isFinite(value) ? value : null
})

const text = computed(() => {
  if (ratio.value === null) return '–'
  return props.signed ? formatPctSigned(ratio.value) : formatPct(ratio.value)
})

const tone = computed(() => {
  const colored = props.colored ?? props.signed
  if (!colored || ratio.value === null) return ''
  const sign = signTone(ratio.value)
  return sign === 'positive' ? 'text-success' : sign === 'negative' ? 'text-error' : ''
})
</script>

<template>
  <span class="tabular-nums whitespace-nowrap" :class="tone">{{ text }}</span>
</template>
