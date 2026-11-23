<script setup lang="ts">
import type { TaxYearDto, VorabpauschaleResponse } from '@finance/shared'

/** Steuern (US4): year switcher, Basiszins, exemption orders and Vorabpauschale. */
const { t } = useI18n()
useHead({ title: t('taxes.title') })
const { accountsParam } = useAccountFilter()
const toast = useToast()

const year = ref(new Date().getFullYear())
const { data: tax, refresh: refreshTax } = await useApi<TaxYearDto>(
  () => `/api/taxes/${year.value}`,
)
const { data: vorab, refresh: refreshVorab } = await useApi<VorabpauschaleResponse>(
  () => `/api/taxes/${year.value}/vorabpauschale`,
  { query: { accounts: accountsParam } },
)

/** Basiszins in percent with two decimals (e.g. 2,29). */
const baseRatePct = ref<number | undefined>()
watch(
  tax,
  (value) => {
    baseRatePct.value =
      value?.baseRate != null ? Math.round(Number(value.baseRate) * 10000) / 100 : undefined
  },
  { immediate: true },
)
const baseRateInput = useTemplateRef<{ inputRef?: HTMLInputElement }>('baseRateInput')

async function saveBaseRate(): Promise<void> {
  if (!tax.value) return
  await apiFetch(`/api/taxes/${year.value}`, {
    method: 'PUT',
    body: {
      assessment: tax.value.assessment,
      baseRate:
        baseRatePct.value === undefined
          ? null
          : String(Math.round(baseRatePct.value * 100) / 10000),
    },
  })
  toast.add({ title: t('common.save'), color: 'success' })
  await Promise.all([refreshTax(), refreshVorab()])
}

async function refreshAll(): Promise<void> {
  await Promise.all([refreshTax(), refreshVorab()])
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.investments') }}</h1>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          color="neutral"
          :aria-label="String(year - 1)"
          @click="year--"
        />
        <span class="w-14 text-center font-semibold" data-testid="tax-year">{{ year }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          color="neutral"
          :aria-label="String(year + 1)"
          @click="year++"
        />
      </div>
      <div class="flex items-end gap-2">
        <UFormField :label="t('taxes.baseRate', { year })">
          <UInputNumber
            ref="baseRateInput"
            v-model="baseRatePct"
            :min="0"
            :max="20"
            :step="0.01"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
            class="w-32"
            data-testid="base-rate"
          />
        </UFormField>
        <span class="pb-2 text-sm text-muted">%</span>
        <UButton :label="t('common.save')" data-testid="base-rate-save" @click="saveBaseRate" />
      </div>
    </div>
    <ExemptionOrders v-if="tax" :tax="tax" @changed="refreshAll" />
    <VorabpauschaleTable
      v-if="vorab"
      :result="vorab"
      @edit-base-rate="baseRateInput?.inputRef?.focus()"
    />
  </section>
</template>
