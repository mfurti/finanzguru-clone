<script setup lang="ts">
/**
 * Initials avatar (research R10): up to two letters on a pastel background
 * derived from the name. No logos are fetched from the internet (FR-025).
 */
const props = withDefaults(defineProps<{ name: string; size?: 'sm' | 'md' | 'lg' }>(), {
  size: 'md',
})
const initials = computed(() => {
  const words = props.name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[1]![0]!
  return letters.toUpperCase()
})
const background = computed(() => nameHex(props.name))
const sizeClass = computed(
  () => ({ sm: 'size-7 text-[0.65rem]', md: 'size-9 text-xs', lg: 'size-12 text-sm' })[props.size],
)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-zinc-900"
    :class="sizeClass"
    :style="{ backgroundColor: background }"
    aria-hidden="true"
    data-testid="avatar"
    >{{ initials }}</span
  >
</template>
