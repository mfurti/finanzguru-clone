<script setup lang="ts">
import type { AccountDto } from '@finance/shared'

const { selected, isAll, toggle, reset } = useAccountFilter()
const { t } = useI18n()

const { data: accounts } = useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})

/** Investments offer only portfolios (depots), like the reference's "Alle Portfolios" (012 P15). */
const route = useRoute()
const portfoliosOnly = computed(() => route.path.startsWith('/investments'))
const visibleAccounts = computed(() =>
  (accounts.value ?? []).filter(
    (account) => !account.isHidden && (!portfoliosOnly.value || account.type === 'depot'),
  ),
)
const shownSelection = computed(() =>
  selected.value.filter((id) => visibleAccounts.value.some((account) => account.id === id)),
)

const label = computed(() => {
  if (isAll.value || shownSelection.value.length === 0)
    return portfoliosOnly.value ? t('filter.allPortfolios') : t('filter.allAccounts')
  if (shownSelection.value.length === 1) {
    return (
      visibleAccounts.value.find((account) => account.id === shownSelection.value[0])?.name ??
      t('filter.oneAccount')
    )
  }
  return portfoliosOnly.value
    ? t('filter.nPortfolios', { n: shownSelection.value.length })
    : t('filter.nAccounts', { n: shownSelection.value.length })
})
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
    <UPopover :content="{ side: 'top', align: 'center' }">
      <UButton
        class="pointer-events-auto rounded-full shadow-lg"
        color="neutral"
        variant="solid"
        icon="i-lucide-layers"
        trailing-icon="i-lucide-chevron-up"
        :label="label"
        data-testid="account-filter"
      />
      <template #content>
        <div class="w-72 max-w-[calc(100vw-2rem)] p-2">
          <UButton
            block
            variant="ghost"
            color="neutral"
            class="justify-start"
            :icon="isAll ? 'i-lucide-check' : undefined"
            :label="portfoliosOnly ? t('filter.allPortfolios') : t('filter.allAccounts')"
            @click="reset"
          />
          <USeparator class="my-1" />
          <p v-if="visibleAccounts.length === 0" class="px-2 py-3 text-sm text-muted">
            {{ t('filter.noAccounts') }}
          </p>
          <div
            v-for="account in visibleAccounts"
            :key="account.id"
            class="flex items-center gap-2 px-2 py-1.5"
          >
            <UCheckbox
              class="min-w-0 flex-1"
              :model-value="selected.includes(account.id)"
              :label="account.name"
              :description="account.institutionName"
              @update:model-value="toggle(account.id)"
            />
            <MerchantLogo :name="account.institutionName" :logo="account.logo" size="sm" />
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
