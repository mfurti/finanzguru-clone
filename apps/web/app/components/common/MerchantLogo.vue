<script setup lang="ts">
import type { LogoRef } from '@finance/shared'

/**
 * Merchant logo of a booking (008): built-in brand glyph or own upload in a round white tile of
 * the same size as the initials avatar (no layout shift), else the initials. Images come from
 * this app's API only – never from the internet.
 */
const props = withDefaults(
  defineProps<{ name: string; logo?: LogoRef; size?: 'sm' | 'md' | 'lg' }>(),
  { logo: null, size: 'md' },
)
/** A broken image (e.g. deleted upload) falls back to initials. */
const failed = ref(false)
watch(
  () => props.logo?.url,
  () => (failed.value = false),
)
const sizeClass = computed(() => ({ sm: 'size-7', md: 'size-9', lg: 'size-12' })[props.size])
</script>

<template>
  <span
    v-if="logo && !failed"
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-default bg-white"
    :class="sizeClass"
    data-testid="merchant-logo"
    :data-kind="logo.kind"
  >
    <img
      :src="logo.url"
      :alt="name"
      loading="lazy"
      decoding="async"
      :class="logo.kind === 'brand' ? 'size-3/5 object-contain' : 'size-full object-cover'"
      @error="failed = true"
    />
  </span>
  <Avatar v-else :name="name" :size="size" />
</template>
