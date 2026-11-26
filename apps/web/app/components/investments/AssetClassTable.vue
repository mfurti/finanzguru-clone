<script setup lang="ts">
import type { AssetClassDto } from '@finance/shared'

/** "Assetklassen": value and share per asset class (US4 scenario 6). */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const { data } = await useApi<AssetClassDto[]>('/api/investments/asset-classes', {
  query: { accounts: accountsParam },
  default: () => [],
})
</script>

<template>
  <div data-testid="asset-classes-card">
    <EmptyState
      v-if="(data?.length ?? 0) === 0"
      :title="t('investments.empty')"
      icon="i-lucide-shapes"
    />
    <ul v-else class="divide-y divide-default text-sm">
      <li
        v-for="row in data"
        :key="row.assetClass"
        class="row-hover flex items-center justify-between gap-3 py-3"
      >
        <span>
          {{ t(`assetClasses.${row.assetClass}`) }}
          <span class="text-muted">({{ row.count }})</span>
        </span>
        <span class="flex items-center gap-4">
          <span class="w-20 text-right text-muted"><Percent :value="row.pct" /></span>
          <Money :cents="row.valueCents" />
        </span>
      </li>
    </ul>
  </div>
</template>
