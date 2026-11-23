<script setup lang="ts">
import { de } from '@nuxt/ui/locale'

const { t } = useI18n()

useHead({
  htmlAttrs: { lang: 'de' },
  titleTemplate: (title) => (title ? `${title} · ${t('app.name')}` : t('app.name')),
})
</script>

<template>
  <UApp :locale="de">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
