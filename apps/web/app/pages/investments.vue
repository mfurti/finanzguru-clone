<script setup lang="ts">
import type { SectionNavItem } from '~/components/common/SectionNav.vue'

/** Investments section: sidebar / dropdown navigation around the sub pages. */
const { t } = useI18n()
const route = useRoute()

const VIEWS = [
  ['positions', '/investments'],
  ['transactions', '/investments/transactions'],
  ['analysis', '/investments/analysis'],
  ['dividends', '/investments/dividends'],
  ['taxes', '/investments/taxes'],
  ['watchlists', '/investments/watchlists'],
] as const

/** Instrument detail pages (/investments/<id>) belong to "Positionen". */
const otherView = computed(() =>
  VIEWS.some(([, path]) => path !== '/investments' && route.path.startsWith(path)),
)

const items = computed<SectionNavItem[]>(() =>
  VIEWS.map(([key, path]) => ({
    key,
    label: t(`investments.views.${key}`),
    // Keep the account filter when switching views.
    to: { path, query: route.query.accounts ? { accounts: route.query.accounts } : {} },
    active: path === '/investments' ? !otherView.value : route.path.startsWith(path),
  })),
)
</script>

<template>
  <SectionNav :items="items" :label="t('nav.investments')">
    <NuxtPage />
  </SectionNav>
</template>
