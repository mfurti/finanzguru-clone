<script setup lang="ts">
import DefaultLayout from './default.vue'

/**
 * Übersicht frame (012 P3): Dashboard, Portfolios & Konten, Transaktionen and the account
 * and depot details share this layout, so the side navigation stays mounted when switching
 * between them (like the Investments and Budget sections); only the page content changes.
 */
const { t } = useI18n()
const route = useRoute()
const customizing = useDashboardCustomizing()
</script>

<template>
  <DefaultLayout>
    <OverviewSection>
      <template #actions>
        <UButton
          v-if="route.path === '/'"
          icon="i-lucide-layout-dashboard"
          variant="ghost"
          color="neutral"
          :label="t('overview.customize.button')"
          data-testid="customize-open"
          @click="customizing = true"
        />
      </template>
      <slot />
    </OverviewSection>
  </DefaultLayout>
</template>
