<script setup lang="ts">
import {
  INSURANCE_TYPES,
  type InsuranceDto,
  type InsuranceType,
  PREMIUM_INTERVALS,
  type PremiumInterval,
} from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Create or edit an insurance contract (US6). */
const props = defineProps<{ contract?: InsuranceDto | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [contract: InsuranceDto] }>()
const { t } = useI18n()

const empty = () => ({
  type: 'health' as InsuranceType,
  provider: '',
  contractNumber: '',
  premium: 0,
  interval: 'monthly' as PremiumInterval,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  notes: '',
})
const form = reactive(empty())
const error = ref<string | null>(null)
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = null
  const c = props.contract
  Object.assign(
    form,
    c
      ? {
          type: c.type,
          provider: c.provider,
          contractNumber: c.contractNumber ?? '',
          premium: c.premiumCents / 100,
          interval: c.interval,
          startDate: c.startDate,
          endDate: c.endDate ?? '',
          notes: c.notes ?? '',
        }
      : empty(),
  )
})

const typeItems = computed(() =>
  INSURANCE_TYPES.map((value) => ({ value, label: t(`insurance.types.${value}`) })),
)
const intervalItems = computed(() =>
  PREMIUM_INTERVALS.map((value) => ({ value, label: t(`insurance.intervals.${value}`) })),
)

async function submit(): Promise<void> {
  busy.value = true
  error.value = null
  const body = {
    type: form.type,
    provider: form.provider,
    contractNumber: form.contractNumber || null,
    premiumCents: Math.round(form.premium * 100),
    interval: form.interval,
    startDate: form.startDate,
    endDate: form.endDate || null,
    notes: form.notes || null,
  }
  try {
    const saved = props.contract
      ? await apiFetch<InsuranceDto>(`/api/insurance/${props.contract.id}`, {
          method: 'PATCH',
          body,
        })
      : await apiFetch<InsuranceDto>('/api/insurance', { method: 'POST', body })
    emit('saved', saved)
    open.value = false
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? t('forms.failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="contract ? t('insurance.edit') : t('insurance.add')">
    <template #body>
      <form id="insurance-form" class="space-y-3" @submit.prevent="submit">
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="t('insurance.type')" required>
            <USelect
              v-model="form.type"
              :items="typeItems"
              class="w-full"
              data-testid="insurance-type"
            />
          </UFormField>
          <UFormField :label="t('insurance.provider')" required>
            <UInput
              v-model="form.provider"
              required
              maxlength="120"
              class="w-full"
              data-testid="insurance-provider"
            />
          </UFormField>
          <UFormField :label="t('insurance.contractNumber')">
            <UInput v-model="form.contractNumber" maxlength="60" class="w-full" />
          </UFormField>
          <UFormField :label="t('insurance.premium')" required>
            <UInputNumber
              v-model="form.premium"
              :min="0"
              :step="0.01"
              :format-options="{ style: 'currency', currency: 'EUR' }"
              locale="de-DE"
              class="w-full"
              data-testid="insurance-premium"
            />
          </UFormField>
          <UFormField :label="t('insurance.interval')">
            <USelect
              v-model="form.interval"
              :items="intervalItems"
              class="w-full"
              data-testid="insurance-interval"
            />
          </UFormField>
          <UFormField :label="t('insurance.start')" required>
            <UInput v-model="form.startDate" type="date" required class="w-full" />
          </UFormField>
          <UFormField :label="t('insurance.end')" :hint="t('forms.optional')">
            <UInput v-model="form.endDate" type="date" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('insurance.notes')">
          <UTextarea v-model="form.notes" :maxlength="2000" class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="insurance-form"
          :loading="busy"
          :disabled="!form.provider || form.premium <= 0"
          :label="t('common.save')"
          data-testid="insurance-save"
        />
      </div>
    </template>
  </UModal>
</template>
