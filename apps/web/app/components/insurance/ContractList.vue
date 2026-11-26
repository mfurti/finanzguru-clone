<script setup lang="ts">
import { formatDate, type InsuranceDto } from '@finance/shared'

/** Contracts with premium, interval and yearly cost. */
defineProps<{ contracts: InsuranceDto[] }>()
defineEmits<{ edit: [contract: InsuranceDto]; remove: [contract: InsuranceDto] }>()
const { t } = useI18n()
</script>

<template>
  <ul class="divide-y divide-default" data-testid="contract-list">
    <li
      v-for="contract in contracts"
      :key="contract.id"
      class="row-hover flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="min-w-0">
        <div class="font-medium">
          {{ t(`insurance.types.${contract.type}`) }} · {{ contract.provider }}
        </div>
        <div class="text-xs text-muted">
          <template v-if="contract.contractNumber">{{ contract.contractNumber }} · </template>
          {{ t('insurance.since', { date: formatDate(contract.startDate) }) }}
          <template v-if="contract.endDate"> – {{ formatDate(contract.endDate) }}</template>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right text-sm">
          <div>
            <Money :cents="contract.premiumCents" /> {{ t(`insurance.per.${contract.interval}`) }}
          </div>
          <div class="text-xs text-muted" data-testid="yearly-cost">
            <Money :cents="contract.yearlyCostCents" /> {{ t('insurance.perYear') }}
          </div>
        </div>
        <UButton
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          :aria-label="t('common.edit')"
          @click="$emit('edit', contract)"
        />
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          variant="ghost"
          color="neutral"
          :aria-label="t('common.delete')"
          data-testid="contract-delete"
          @click="$emit('remove', contract)"
        />
      </div>
    </li>
  </ul>
</template>
