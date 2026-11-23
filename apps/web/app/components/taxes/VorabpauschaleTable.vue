<script setup lang="ts">
import { FUND_TYPE_LABELS, type VorabpauschaleResponse } from '@finance/shared'

/** Estimated Vorabpauschale per fund (US4); always labeled as an estimate. */
defineProps<{ result: VorabpauschaleResponse }>()
const emit = defineEmits<{ editBaseRate: [] }>()
const { t } = useI18n()
</script>

<template>
  <UCard data-testid="vorabpauschale">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('taxes.vorab', { year: result.year }) }}</h2>
        <UBadge variant="soft" color="neutral">{{ t('common.estimate') }}</UBadge>
      </div>
    </template>

    <UAlert
      v-if="result.baseRate === null"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      class="mb-4"
      :title="t('taxes.baseRateMissing')"
      :actions="[
        { label: t('taxes.baseRate', { year: result.year }), onClick: () => emit('editBaseRate') },
      ]"
      data-testid="base-rate-missing"
    />

    <p v-if="result.rows.length === 0" class="text-sm text-muted">{{ t('taxes.noFunds') }}</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[520px] text-sm">
        <thead>
          <tr class="border-b border-default text-left text-xs text-muted">
            <th class="py-2 font-medium">{{ t('dividends.security') }}</th>
            <th class="py-2 font-medium">{{ t('taxes.fundType') }}</th>
            <th class="py-2 text-right font-medium">{{ t('taxes.basisertrag') }}</th>
            <th class="py-2 text-right font-medium">{{ t('taxes.vorabpauschale') }}</th>
            <th class="py-2 text-right font-medium">{{ t('taxes.taxable') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="row in result.rows" :key="row.instrumentId" class="row-hover">
            <td class="py-2 pr-2">
              <NuxtLink :to="`/investments/${row.instrumentId}`" class="link-hover">{{
                row.name
              }}</NuxtLink>
            </td>
            <td class="py-2 text-muted">{{ FUND_TYPE_LABELS[row.fundType] }}</td>
            <td class="py-2 text-right"><Money :cents="row.basisertragCents" /></td>
            <td class="py-2 text-right"><Money :cents="row.vorabpauschaleCents" /></td>
            <td class="py-2 text-right font-medium"><Money :cents="row.taxableCents" /></td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t border-default">
            <td colspan="4" class="py-2 text-right text-muted">{{ t('taxes.taxable') }}</td>
            <td class="py-2 text-right font-semibold" data-testid="vorab-total">
              <Money :cents="result.totalTaxableCents" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="mt-3 text-xs text-muted">{{ t('taxes.vorabNote') }}</p>
  </UCard>
</template>
