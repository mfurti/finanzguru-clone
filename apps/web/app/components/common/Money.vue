<script setup lang="ts">
import { formatEur, formatEurSigned, signTone } from '@finance/shared'

/**
 * Euro amount from integer cents in de-DE format (FR-004).
 * `signed` shows +/- and colors gains green and losses red.
 * `animate` counts to a new value instead of jumping (headline amounts).
 */
const props = withDefaults(
  defineProps<{
    cents: number | null | undefined
    signed?: boolean
    colored?: boolean
    animate?: boolean
  }>(),
  { signed: false, colored: undefined, animate: false },
)

const counted = useCountUp(() => props.cents)
const text = computed(() => {
  const cents = props.animate ? counted.value : props.cents
  if (cents === null || cents === undefined) return '–'
  return props.signed ? formatEurSigned(cents) : formatEur(cents)
})

const tone = computed(() => {
  const colored = props.colored ?? props.signed
  if (!colored || props.cents === null || props.cents === undefined) return ''
  const sign = signTone(props.cents)
  return sign === 'positive' ? 'text-success' : sign === 'negative' ? 'text-error' : ''
})
</script>

<template>
  <span class="tabular-nums whitespace-nowrap" :class="tone">{{ text }}</span>
</template>
