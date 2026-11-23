<script setup lang="ts">
withDefaults(defineProps<{ showName?: boolean }>(), { showName: true })
</script>

<template>
  <span class="inline-flex items-center gap-2 font-semibold tracking-tight">
    <!-- Own mark: a compass needle in a rounded square. -->
    <svg viewBox="0 0 32 32" class="size-7 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="9" class="fill-primary" />
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke="white"
        stroke-opacity=".35"
        stroke-width="1.5"
      />
      <path d="M16 7.5 19 16h-6z" fill="white" />
      <path d="M16 24.5 13 16h6z" fill="white" fill-opacity=".55" />
    </svg>
    <span v-if="showName" class="text-base">{{ $t('app.name') }}</span>
  </span>
</template>
