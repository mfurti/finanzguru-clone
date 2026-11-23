<script setup lang="ts">
import type { AccountDto } from '@finance/shared'

const { selected, isAll, toggle, reset } = useAccountFilter()
const { t } = useI18n()

const { data: accounts } = useFetch<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})

const visibleAccounts = computed(() =>
  (accounts.value ?? []).filter((account) => !account.isHidden),
)

const label = computed(() => {
  if (isAll.value) return t('filter.allAccounts')
  if (selected.value.length === 1) {
    return (
      visibleAccounts.value.find((account) => account.id === selected.value[0])?.name ??
      t('filter.oneAccount')
    )
  }
  return t('filter.nAccounts', { n: selected.value.length })
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
            :label="t('filter.allAccounts')"
            @click="reset"
          />
          <USeparator class="my-1" />
          <p v-if="visibleAccounts.length === 0" class="px-2 py-3 text-sm text-muted">
            {{ t('filter.noAccounts') }}
          </p>
          <UCheckbox
            v-for="account in visibleAccounts"
            :key="account.id"
            class="px-2 py-1.5"
            :model-value="selected.includes(account.id)"
            :label="account.name"
            :description="account.institutionName"
            @update:model-value="toggle(account.id)"
          />
        </div>
      </template>
    </UPopover>
  </div>
</template>
