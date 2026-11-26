<script setup lang="ts">
import type { AccountsOverview, AccountType } from '@finance/shared'

definePageMeta({ layout: 'overview' })

/** Portfolios & Konten (003 US2): one card per group, rows open the detail pages. */
const { t } = useI18n()
useHead({ title: t('overview.views.accounts') })
const { accountsParam } = useAccountFilter()
const { data, refresh } = await useApi<AccountsOverview>('/api/accounts/overview', {
  query: { accounts: accountsParam },
  default: () => ({ groups: [] }),
})
const accountOpen = ref(false)
const presetType = ref<AccountType | undefined>()
function add(type?: AccountType): void {
  presetType.value = type
  accountOpen.value = true
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('overview.views.accounts') }}</h1>
    <EmptyState
      v-if="(data?.groups.length ?? 0) === 0"
      :title="t('overview.views.accounts')"
      icon="i-lucide-wallet"
    />
    <AccountGroupCard
      v-for="group in data?.groups ?? []"
      :key="group.kind"
      :group="group"
      @add="add"
    />
    <AccountFormModal v-model:open="accountOpen" :preset-type="presetType" @created="refresh()" />
  </section>
</template>
