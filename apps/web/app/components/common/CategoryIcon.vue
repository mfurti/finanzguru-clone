<script setup lang="ts">
/** Colored tile with the category's icon (US3); color and icon come from the caller. */
withDefaults(defineProps<{ icon: string; color: string; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-lg text-zinc-900"
    :class="size === 'sm' ? 'size-6' : 'size-8'"
    :style="{ backgroundColor: color }"
    aria-hidden="true"
    data-testid="category-icon"
  >
    <UIcon :name="icon" :class="size === 'sm' ? 'size-3.5' : 'size-4.5'" />
  </span>
</template>
