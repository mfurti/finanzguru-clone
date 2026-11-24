<script setup lang="ts">
import type { SectionNavItem } from '~/components/common/SectionNav.vue'

/** Budget section: sidebar / dropdown navigation around the sub pages. */
const { t } = useI18n()
const route = useRoute()

const VIEWS = [
  ['analysis', '/budget'],
  ['budgets', '/budget/budgets'],
] as const

const items = computed<SectionNavItem[]>(() =>
  VIEWS.map(([key, path]) => ({
    key,
    label: t(`budget.nav.${key}`),
    to: { path, query: route.query },
    active: path === '/budget' ? route.path === path : route.path.startsWith(path),
  })),
)
</script>

<template>
  <SectionNav :items="items" :label="t('nav.budget')">
    <NuxtPage />
  </SectionNav>
</template>
