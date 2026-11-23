<script setup lang="ts">
import type { DividendCalendarEntry, InstrumentDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Add or edit an expected dividend payment (US2). */
const props = defineProps<{ entry: DividendCalendarEntry | null }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()

const { data: instruments } = await useApi<InstrumentDto[]>('/api/instruments', {
  key: 'instruments',
  default: () => [],
})
const items = computed(() => (instruments.value ?? []).map((i) => ({ label: i.name, value: i.id })))

const form = reactive({
  instrumentId: undefined as string | undefined,
  payDate: '',
  exDate: '',
  amountPerShare: 0 as number | undefined,
  note: '',
})
const error = ref<string | null>(null)
const busy = ref(false)

watch(open, (value) => {
  if (!value) return
  error.value = null
  form.instrumentId = props.entry?.instrumentId
  form.payDate = props.entry?.date ?? ''
  form.exDate = props.entry?.exDate ?? ''
  form.amountPerShare = props.entry?.amountPerShare ? Number(props.entry.amountPerShare) : undefined
  form.note = props.entry?.note ?? ''
})

async function save(): Promise<void> {
  busy.value = true
  error.value = null
  const body = {
    instrumentId: form.instrumentId,
    payDate: form.payDate,
    exDate: form.exDate || null,
    amountPerShare: String(form.amountPerShare ?? 0),
    note: form.note || null,
  }
  try {
    if (props.entry?.id) {
      await apiFetch(`/api/dividends/expected/${props.entry.id}`, { method: 'PATCH', body })
    } else {
      await apiFetch('/api/dividends/expected', { method: 'POST', body })
    }
    emit('saved')
    open.value = false
  } catch (cause) {
    error.value =
      (cause as FetchError).data?.data?.issues?.[0]?.message ??
      (cause as FetchError).data?.statusMessage ??
      String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('dividends.addExpected')">
    <template #body>
      <div class="space-y-3" data-testid="expected-form">
        <UFormField :label="t('dividends.security')" required>
          <USelectMenu
            v-model="form.instrumentId"
            :items="items"
            value-key="value"
            class="w-full"
            data-testid="expected-instrument"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('dividends.payDate')" required>
            <UInput v-model="form.payDate" type="date" class="w-full" data-testid="expected-pay" />
          </UFormField>
          <UFormField :label="t('dividends.exDate')">
            <UInput v-model="form.exDate" type="date" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('dividends.perShare')" required>
          <UInputNumber
            v-model="form.amountPerShare"
            :min="0"
            :step="0.01"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 6 }"
            class="w-full"
            data-testid="expected-amount"
          />
        </UFormField>
        <UFormField :label="t('dividends.note')">
          <UInput v-model="form.note" maxlength="200" class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      </div>
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
          :loading="busy"
          :disabled="!form.instrumentId || !form.payDate || !form.amountPerShare"
          :label="t('common.save')"
          data-testid="expected-save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
