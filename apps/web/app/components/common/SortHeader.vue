<script setup lang="ts">
/** Column header button with sort arrow; `dir` is null when the column is not sorted. */
defineProps<{ label: string; dir: 'asc' | 'desc' | null; align?: 'left' | 'right' }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1 font-semibold whitespace-nowrap transition-colors hover:text-highlighted"
    :class="align === 'right' ? 'ml-auto flex-row-reverse' : ''"
    :aria-sort="dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'"
    data-testid="sort-header"
    @click="$emit('toggle')"
  >
    <span>{{ label }}</span>
    <UIcon
      :name="
        dir === 'asc'
          ? 'i-lucide-arrow-up'
          : dir === 'desc'
            ? 'i-lucide-arrow-down'
            : 'i-lucide-arrow-up-down'
      "
      class="size-3.5"
      :class="dir ? 'text-highlighted' : 'text-dimmed'"
    />
  </button>
</template>
