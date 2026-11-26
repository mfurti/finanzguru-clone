<script setup lang="ts">
/** Shown instead of zeros when there is no data (never `NaN` or fake `0,00 €`). */
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
    actionLabel?: string
    actionTo?: string
  }>(),
  { icon: 'i-lucide-inbox' },
)
defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
    <UIcon :name="icon" class="size-8 text-muted" />
    <p class="font-medium">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-muted">{{ description }}</p>
    <UButton
      v-if="actionLabel"
      class="mt-2"
      :to="actionTo"
      :label="actionLabel"
      @click="$emit('action')"
    />
  </div>
</template>
