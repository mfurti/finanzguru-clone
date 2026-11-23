<script setup lang="ts">
import type { SectionNavItem } from '~/components/common/SectionNav.vue'

/** Übersicht section: Dashboard, Portfolios & Konten, Transaktionen (sidebar / dropdown). */
defineSlots<{ default(): unknown }>()
const { t } = useI18n()
const route = useRoute()

const VIEWS = [
  ['dashboard', '/'],
  ['accounts', '/accounts'],
  ['transactions', '/transactions'],
] as const

const items = computed<SectionNavItem[]>(() =>
  VIEWS.map(([key, path]) => ({
    key,
    label: t(`overview.views.${key}`),
    // Keep the account filter when switching views.
    to: { path, query: route.query.accounts ? { accounts: route.query.accounts } : {} },
    active: route.path === path,
  })),
)
</script>

<template>
  <SectionNav :items="items" :label="t('nav.overview')">
    <slot />
  </SectionNav>
</template>
