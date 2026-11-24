<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const route = useRoute()
const session = useState<{ displayName: string } | null>('session')

async function logout(): Promise<void> {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  session.value = null
  await navigateTo('/login')
}

/** Keep the account filter when switching tabs. */
const withFilter = (path: string) => ({
  path,
  query: route.query.accounts ? { accounts: route.query.accounts } : {},
})

const tabs = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.overview'),
    icon: 'i-lucide-compass',
    to: withFilter('/'),
    active: ['/', '/accounts', '/transactions'].includes(route.path),
  },
  {
    label: t('nav.investments'),
    icon: 'i-lucide-chart-no-axes-column',
    to: withFilter('/investments'),
    active: route.path.startsWith('/investments'),
  },
  {
    label: t('nav.budget'),
    icon: 'i-lucide-wallet',
    to: withFilter('/budget'),
    active: route.path.startsWith('/budget'),
  },
  {
    label: t('nav.insurance'),
    icon: 'i-lucide-shield',
    to: withFilter('/insurance'),
    active: route.path.startsWith('/insurance'),
  },
])
</script>

<template>
  <div class="min-h-dvh bg-(--app-page)">
    <header class="sticky top-0 z-30 border-b border-default bg-(--app-page)/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-[1380px] items-center gap-2 px-4 sm:px-6">
        <NuxtLink to="/" class="mr-auto" :aria-label="t('app.name')">
          <BrandLogo />
        </NuxtLink>
        <slot name="header-actions" />
        <GlobalSearch />
        <UColorModeButton />
        <UButton
          icon="i-lucide-settings"
          color="neutral"
          variant="ghost"
          to="/settings/sources"
          :aria-label="t('header.settings')"
        />
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          :aria-label="t('header.logout')"
          :title="session?.displayName"
          data-testid="logout"
          @click="logout"
        />
      </div>
      <nav
        class="mx-auto max-w-[1380px] overflow-x-auto px-2 sm:px-4 [scrollbar-width:none]"
        :aria-label="t('nav.label')"
      >
        <!-- Active tab underlined like the reference (FR-002), no pill background. -->
        <UNavigationMenu
          :items="tabs"
          orientation="horizontal"
          variant="link"
          color="neutral"
          highlight
          highlight-color="neutral"
          class="min-w-max"
          :ui="{
            link: 'px-3 py-3 font-medium after:h-0.5',
            linkLeadingIcon: 'size-4',
            indicator: 'hidden',
          }"
          data-testid="main-tabs"
        />
      </nav>
    </header>

    <main class="mx-auto max-w-[1380px] px-4 pt-4 pb-24 sm:px-6 sm:pt-6">
      <slot />
    </main>

    <AccountFilter />

    <footer class="mx-auto max-w-[1380px] px-4 pb-20 text-center text-xs text-muted sm:px-6">
      {{ t('app.footer') }}
    </footer>
  </div>
</template>
