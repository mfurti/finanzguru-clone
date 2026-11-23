<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * Section navigation like the reference: a sticky sidebar on wide screens
 * (active entry as a pill) and a dropdown button above the content below
 * 1024 px. The page content goes into the default slot.
 */
export interface SectionNavItem {
  key: string
  label: string
  to: RouteLocationRaw
  active: boolean
}

const props = defineProps<{ items: SectionNavItem[]; label: string }>()
defineSlots<{ default(): unknown }>()

const current = computed(() => props.items.find((item) => item.active) ?? props.items[0])
const menuItems = computed(() =>
  props.items.map((item) => ({
    label: item.label,
    to: item.to,
    class: item.active ? 'font-semibold text-highlighted' : undefined,
  })),
)
</script>

<template>
  <div class="lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-8">
    <aside class="hidden lg:block">
      <nav
        class="sticky top-32 flex flex-col items-start gap-2 pt-2"
        :aria-label="label"
        data-testid="section-nav"
      >
        <NuxtLink
          v-for="item in items"
          :key="item.key"
          :to="item.to"
          :aria-current="item.active ? 'page' : undefined"
          class="rounded-md px-2 text-sm leading-[22px] transition-colors"
          :class="
            item.active
              ? 'bg-(--app-card) font-semibold text-highlighted'
              : 'text-muted hover:text-default'
          "
          :data-testid="`section-nav-${item.key}`"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>

    <div class="min-w-0">
      <div class="mb-4 lg:hidden">
        <UDropdownMenu :items="menuItems" :content="{ align: 'start' }">
          <UButton
            color="neutral"
            variant="soft"
            trailing-icon="i-lucide-chevron-down"
            :label="current?.label"
            class="rounded-full bg-(--app-card) px-4"
            data-testid="section-nav-menu"
          />
        </UDropdownMenu>
      </div>
      <slot />
    </div>
  </div>
</template>
