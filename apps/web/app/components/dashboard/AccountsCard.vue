<script setup lang="ts">
import type { AccountTree } from '@finance/shared'

/** "Portfolios & Konten": depots (with reference accounts) and other accounts. */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()

const { data } = await useApi<AccountTree>('/api/accounts/tree', {
  query: { accounts: accountsParam },
  default: () => ({ groups: [] }),
})

const collapsed = ref<Record<string, boolean>>({})
const toggle = (type: string) => {
  collapsed.value = { ...collapsed.value, [type]: !collapsed.value[type] }
}
/** Bank and broker logos (009). */
const { byAccount } = await useAccountLogos()
</script>

<template>
  <UCard data-testid="accounts-card">
    <template #header>
      <CardTitle :title="t('overview.accounts.title')" to="/accounts" />
    </template>

    <EmptyState
      v-if="(data?.groups.length ?? 0) === 0"
      :title="t('overview.accounts.empty')"
      icon="i-lucide-landmark"
      :action-label="t('overview.empty.action')"
      action-to="/settings/sources"
    />
    <div v-else class="space-y-2 text-sm">
      <section v-for="group in data!.groups" :key="group.type">
        <button
          type="button"
          class="row-hover flex w-full items-center justify-between gap-2 py-2 font-medium"
          :aria-expanded="!collapsed[group.type]"
          @click="toggle(group.type)"
        >
          <span class="flex items-center gap-1">
            <UIcon
              :name="collapsed[group.type] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
              class="size-4"
            />
            {{ t(`overview.accounts.${group.type}`) }}
          </span>
          <Money :cents="group.totalCents" />
        </button>
        <ul v-show="!collapsed[group.type]" class="divide-y divide-default">
          <template v-for="item in group.items" :key="item.id">
            <li class="row-hover flex items-center justify-between gap-3 py-2 pl-7">
              <MerchantLogo :name="item.institution" :logo="byAccount(item.id)" size="sm" />
              <span class="min-w-0 flex-1">
                <NuxtLink
                  v-if="group.type === 'depots'"
                  :to="{ path: '/investments', query: { accounts: item.id } }"
                  class="block truncate link-hover"
                >
                  {{ item.name }}
                </NuxtLink>
                <span v-else class="block truncate">{{ item.name }}</span>
                <span class="text-xs text-muted">{{ item.institution }}</span>
              </span>
              <Money :cents="item.valueCents" />
            </li>
            <li
              v-for="child in item.children ?? []"
              :key="child.id"
              class="row-hover flex items-center justify-between gap-3 py-2 pl-12 text-muted"
            >
              <span class="flex min-w-0 items-center gap-1">
                <UIcon name="i-lucide-corner-down-right" class="size-3.5 shrink-0" />
                <span class="truncate">{{ child.name }}</span>
              </span>
              <Money :cents="child.valueCents" />
            </li>
          </template>
        </ul>
      </section>
    </div>
  </UCard>
</template>
