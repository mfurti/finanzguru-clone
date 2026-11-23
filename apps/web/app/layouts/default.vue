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
    active: route.path === '/',
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
  <div class="min-h-dvh bg-default">
    <header class="sticky top-0 z-30 border-b border-default bg-default/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <NuxtLink to="/" class="mr-auto" :aria-label="t('app.name')">
          <BrandLogo />
        </NuxtLink>
        <slot name="header-actions" />
        <AddMenu />
        <UButton
          icon="i-lucide-search"
          color="neutral"
          variant="ghost"
          :aria-label="t('header.search')"
        />
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
        class="mx-auto max-w-6xl overflow-x-auto px-2 [scrollbar-width:none]"
        :aria-label="t('nav.label')"
      >
        <UNavigationMenu :items="tabs" orientation="horizontal" class="min-w-max" />
      </nav>
    </header>

    <main class="mx-auto max-w-6xl px-4 pt-4 pb-24">
      <slot />
    </main>

    <AccountFilter />

    <footer class="mx-auto max-w-6xl px-4 pb-20 text-center text-xs text-muted">
      {{ t('app.footer') }}
    </footer>
  </div>
</template>
