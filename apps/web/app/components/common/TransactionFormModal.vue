<script setup lang="ts">
import type { AccountDto, TransactionDto, TransactionType } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** "Transaktion erfassen" for cash accounts and simple trades (FR-056). */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [transaction: TransactionDto] }>()
const { t } = useI18n()

const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})

const today = () => new Date().toISOString().slice(0, 10)
const form = reactive({
  accountId: '',
  bookingDate: today(),
  direction: 'expense' as 'expense' | 'income' | 'buy' | 'sell',
  amount: 0,
  counterparty: '',
  purpose: '',
  isin: '',
  quantity: 0,
})
const error = ref<string | null>(null)
const busy = ref(false)

const selected = computed(() => accounts.value?.find((acc) => acc.id === form.accountId))
const isDepot = computed(() => selected.value?.type === 'depot')
const accountItems = computed(() =>
  (accounts.value ?? []).map((acc) => ({
    value: acc.id,
    label: `${acc.name} · ${acc.institutionName}`,
  })),
)
const directionItems = computed(() =>
  (isDepot.value ? (['buy', 'sell'] as const) : (['expense', 'income'] as const)).map((value) => ({
    value,
    label: t(`transactionTypes.${value}`),
  })),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, {
    accountId: accounts.value?.[0]?.id ?? '',
    bookingDate: today(),
    direction: 'expense',
    amount: 0,
    counterparty: '',
    purpose: '',
    isin: '',
    quantity: 0,
  })
  error.value = null
})
watch(isDepot, (depot) => {
  form.direction = depot ? 'buy' : 'expense'
})

async function submit(): Promise<void> {
  busy.value = true
  error.value = null
  const cents = Math.round(Math.abs(form.amount) * 100)
  const outflow = form.direction === 'expense' || form.direction === 'buy'
  const type: TransactionType = form.direction
  try {
    const created = await apiFetch<TransactionDto>('/api/transactions', {
      method: 'POST',
      body: {
        accountId: form.accountId,
        bookingDate: form.bookingDate,
        amountCents: outflow ? -cents : cents,
        type,
        counterparty: form.counterparty || undefined,
        purpose: form.purpose || undefined,
        ...(isDepot.value && {
          isin: form.isin.trim().toUpperCase(),
          quantity: String(form.quantity),
          unitPrice: form.quantity > 0 ? String(Math.abs(form.amount) / form.quantity) : undefined,
        }),
      },
    })
    emit('created', created)
    open.value = false
    await refreshNuxtData()
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? t('forms.failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('add.transaction')">
    <template #body>
      <EmptyState
        v-if="accountItems.length === 0"
        :title="t('add.noAccounts')"
        icon="i-lucide-landmark"
      />
      <form v-else id="transaction-form" class="space-y-3" @submit.prevent="submit">
        <UFormField :label="t('forms.account')" required>
          <USelect v-model="form.accountId" :items="accountItems" class="w-full" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('forms.date')" required>
            <UInput v-model="form.bookingDate" type="date" required class="w-full" />
          </UFormField>
          <UFormField :label="t('forms.type')">
            <USelect v-model="form.direction" :items="directionItems" class="w-full" />
          </UFormField>
        </div>
        <UFormField :label="t('forms.amount')" required>
          <UInputNumber
            v-model="form.amount"
            :min="0"
            :step="0.01"
            :format-options="{ style: 'currency', currency: 'EUR' }"
            locale="de-DE"
            class="w-full"
            data-testid="transaction-amount"
          />
        </UFormField>
        <template v-if="isDepot">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="ISIN" required>
              <UInput v-model="form.isin" maxlength="12" class="w-full" />
            </UFormField>
            <UFormField :label="t('forms.quantity')" required>
              <UInputNumber v-model="form.quantity" :min="0" :step="0.000001" class="w-full" />
            </UFormField>
          </div>
        </template>
        <UFormField :label="t('forms.counterparty')">
          <UInput v-model="form.counterparty" class="w-full" />
        </UFormField>
        <UFormField :label="t('forms.purpose')">
          <UInput v-model="form.purpose" class="w-full" />
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
          form="transaction-form"
          :disabled="!form.accountId || form.amount <= 0"
          :loading="busy"
          :label="t('common.save')"
        />
      </div>
    </template>
  </UModal>
</template>
