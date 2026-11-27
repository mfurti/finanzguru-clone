<script setup lang="ts">
import type { AccountDto } from '@finance/shared'

/** "Kontostand": sum of the selected (or all visible) cash accounts (US1). */
const { t } = useI18n()
const { selected } = useAccountFilter()
const { settings } = useSettings()
const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})
const total = computed(() =>
  (accounts.value ?? [])
    .filter((acc) => acc.type !== 'depot')
    .filter((acc) =>
      selected.value.length
        ? selected.value.includes(acc.id)
        : !acc.isHidden && (!acc.archivedAt || settings.value.archivedInSums),
    )
    .reduce((sum, acc) => sum + acc.balanceCents, 0),
)
</script>

<template>
  <UCard data-testid="balance-tile">
    <p class="flex items-center gap-1 text-sm text-muted">
      {{ t('txws.balance') }}
      <InfoTooltip :text="t('txws.balanceInfo')" />
    </p>
    <Money :cents="total" class="mt-1 block text-2xl font-bold" />
  </UCard>
</template>
