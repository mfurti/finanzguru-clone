<script setup lang="ts">
import { de } from '@nuxt/ui/locale'

const { t } = useI18n()
const { settings, loaded, update } = useSettings()
const colorMode = useColorMode()

useHead({
  // Table density from the owner settings (014): compact tightens table rows.
  htmlAttrs: {
    lang: 'de',
    class: () => (settings.value.density === 'compact' ? 'density-compact' : ''),
  },
  titleTemplate: (title) => (title ? `${title} · ${t('app.name')}` : t('app.name')),
})

/**
 * Popups lock the page scroll. `html` already reserves the scrollbar width
 * (scrollbar-gutter: stable), so the lock must not add it again as body padding;
 * otherwise the page narrows by the scrollbar width while a popup is open.
 */
const scrollBody = { padding: 0, margin: 0 }

// Privacy mode (014): every formatted amount and percentage is masked while on.
watch(
  () => settings.value.privacyMode,
  (on) => {
    privacyOn.value = on
  },
  { immediate: true },
)

// Colour mode stored with the owner settings (014) wins over the browser's last choice.
watch(
  () => (loaded.value ? settings.value.colorMode : null),
  (mode) => {
    if (import.meta.client && mode) colorMode.preference = mode
  },
  { immediate: true },
)
// The header button changes the colour mode directly: keep the setting in step.
watch(
  () => colorMode.preference,
  (mode) => {
    if (!loaded.value || mode === settings.value.colorMode) return
    if (mode === 'light' || mode === 'dark' || mode === 'system') void update({ colorMode: mode })
  },
)
</script>

<template>
  <UApp :locale="de" :scroll-body="scrollBody">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
