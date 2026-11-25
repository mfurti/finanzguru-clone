<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

/**
 * Card header like the reference (007 US3): title as "Titel ›" link, controls on the right
 * (slot) and an optional ⋮ menu.
 */
defineProps<{ title: string; to?: string; menu?: DropdownMenuItem[][] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2" data-testid="card-title">
    <h2 class="font-semibold">
      <NuxtLink v-if="to" :to="to" class="inline-flex items-center gap-0.5 link-hover">
        {{ title }}
        <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
      </NuxtLink>
      <template v-else>{{ title }}</template>
    </h2>
    <div class="flex items-center gap-1">
      <slot />
      <UDropdownMenu v-if="menu" :items="menu" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          size="sm"
          variant="ghost"
          color="neutral"
          :aria-label="t('refine.chartMenu')"
        />
      </UDropdownMenu>
    </div>
  </div>
</template>
