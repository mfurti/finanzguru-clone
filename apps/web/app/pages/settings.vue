<script setup lang="ts">
import type { SectionNavItem } from '~/components/common/SectionNav.vue'

/** Settings area (014): side navigation around the setting groups. */
const { t } = useI18n()
const route = useRoute()

/** Order of the groups; each later 014 task adds its page here. */
const GROUPS = [
  'accounts',
  'data',
  'display',
  'finance',
  'sources',
  'categories',
  'inflation',
] as const

const items = computed<SectionNavItem[]>(() =>
  GROUPS.map((key) => ({
    key,
    label: t(`settings.${key}`),
    to: `/settings/${key}`,
    active: route.path.startsWith(`/settings/${key}`),
  })),
)
</script>

<template>
  <SectionNav :items="items" :label="t('settings.title')" :add="false">
    <NuxtPage />
  </SectionNav>
</template>
