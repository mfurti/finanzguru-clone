<script setup lang="ts">
import { de } from '@nuxt/ui/locale'

const { t } = useI18n()

useHead({
  htmlAttrs: { lang: 'de' },
  titleTemplate: (title) => (title ? `${title} · ${t('app.name')}` : t('app.name')),
})

/**
 * Popups lock the page scroll. `html` already reserves the scrollbar width
 * (scrollbar-gutter: stable), so the lock must not add it again as body padding;
 * otherwise the page narrows by the scrollbar width while a popup is open.
 */
const scrollBody = { padding: 0, margin: 0 }
</script>

<template>
  <UApp :locale="de" :scroll-body="scrollBody">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
