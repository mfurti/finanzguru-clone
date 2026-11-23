<script setup lang="ts">
/** Sub navigation of the Investments tab (scrolls horizontally on phones). */
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
const items = computed(() =>
  VIEWS.map(([key, path]) => ({
    label: t(`investments.views.${key}`),
    to: { path, query: route.query },
    active: path === '/investments' ? route.path === path : route.path.startsWith(path),
  })),
)
</script>

<template>
  <nav class="mb-4 overflow-x-auto border-b border-default [scrollbar-width:none]">
    <UNavigationMenu :items="items" class="min-w-max" />
  </nav>
</template>
