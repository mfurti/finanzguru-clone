<script setup lang="ts">
/** Small "i" icon that explains a figure (e.g. TWROR, IZF). */
defineProps<{ text: string }>()
</script>

<template>
  <UTooltip :text="text" :content="{ side: 'top' }">
    <UIcon
      name="i-lucide-info"
      class="size-3.5 shrink-0 cursor-help align-middle text-muted"
      :aria-label="text"
      tabindex="0"
    />
  </UTooltip>
</template>
