<script setup lang="ts">
import type { SectionNavItem } from '~/components/common/SectionNav.vue'

/** Übersicht section: Dashboard, Portfolios & Konten, Transaktionen (sidebar / dropdown). */
defineSlots<{ default(): unknown; actions(): unknown }>()
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
    // Detail pages (/accounts/:id, /depots/:id) belong to Portfolios & Konten.
    active:
      path === '/'
        ? route.path === '/'
        : route.path.startsWith(path) || (key === 'accounts' && route.path.startsWith('/depots')),
  })),
)
</script>

<template>
  <SectionNav :items="items" :label="t('nav.overview')">
    <template #actions><slot name="actions" /></template>
    <slot />
  </SectionNav>
</template>
