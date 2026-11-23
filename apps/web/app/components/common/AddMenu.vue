<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

/** Header "Hinzufügen": CSV import, new account, new transaction. */
const { t } = useI18n()
const accountOpen = ref(false)
const transactionOpen = ref(false)

const items = computed<DropdownMenuItem[]>(() => [
  { label: t('add.csv'), icon: 'i-lucide-file-up', to: '/settings/sources' },
  {
    label: t('add.account'),
    icon: 'i-lucide-landmark',
    onSelect: () => (accountOpen.value = true),
  },
  {
    label: t('add.transaction'),
    icon: 'i-lucide-receipt-euro',
    onSelect: () => (transactionOpen.value = true),
  },
])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton icon="i-lucide-plus" size="sm" :aria-label="t('add.button')" data-testid="add-menu">
      <span class="hidden sm:inline">{{ t('add.button') }}</span>
    </UButton>
  </UDropdownMenu>
  <AccountFormModal v-model:open="accountOpen" />
  <TransactionFormModal v-model:open="transactionOpen" />
</template>
