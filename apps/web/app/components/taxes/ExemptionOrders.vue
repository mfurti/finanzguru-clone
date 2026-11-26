<script setup lang="ts">
import { type AccountDto, formatEur, type TaxYearDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Freistellungsaufträge of a year: allowance bar, usage per broker, add/edit/delete (US4). */
const props = defineProps<{ tax: TaxYearDto }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()

const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})
const brokers = computed(() => {
  const seen = new Map<string, string>()
  for (const acc of accounts.value ?? []) seen.set(acc.institutionId, acc.institutionName)
  return [...seen.entries()]
    .filter(([id]) => !props.tax.orders.some((o) => o.institutionId === id))
    .map(([value, label]) => ({ value, label }))
})

const usedPct = computed(() =>
  Math.min(100, (props.tax.usedCents / props.tax.allowanceCents) * 100),
)
const assessment = computed({
  get: () => props.tax.assessment,
  set: async (value) => {
    await apiFetch(`/api/taxes/${props.tax.year}`, {
      method: 'PUT',
      body: { assessment: value, baseRate: props.tax.baseRate },
    })
    emit('changed')
  },
})

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const institutionId = ref<string | undefined>()
const amount = ref<number | undefined>(801)
const error = ref<string | null>(null)

function add(): void {
  editingId.value = null
  institutionId.value = brokers.value[0]?.value
  amount.value = undefined
  error.value = null
  formOpen.value = true
}
function edit(order: TaxYearDto['orders'][number]): void {
  editingId.value = order.id
  institutionId.value = order.institutionId
  amount.value = order.amountCents / 100
  error.value = null
  formOpen.value = true
}
async function save(): Promise<void> {
  error.value = null
  const amountCents = Math.round((amount.value ?? 0) * 100)
  try {
    if (editingId.value) {
      await apiFetch(`/api/taxes/orders/${editingId.value}`, {
        method: 'PATCH',
        body: { amountCents },
      })
    } else {
      await apiFetch(`/api/taxes/${props.tax.year}/orders`, {
        method: 'POST',
        body: { institutionId: institutionId.value, amountCents },
      })
    }
    formOpen.value = false
    emit('changed')
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? String(cause)
  }
}
async function remove(id: string): Promise<void> {
  await apiFetch(`/api/taxes/orders/${id}`, { method: 'DELETE' })
  emit('changed')
}
</script>

<template>
  <UCard data-testid="exemption-orders">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('taxes.orders', { year: tax.year }) }}</h2>
        <div class="flex items-center gap-2">
          <USelect
            v-model="assessment"
            :items="[
              { value: 'single', label: t('taxes.single') },
              { value: 'joint', label: t('taxes.joint') },
            ]"
            class="w-48"
            data-testid="tax-assessment"
          />
          <UButton
            size="sm"
            icon="i-lucide-plus"
            :label="t('taxes.addOrder')"
            :disabled="brokers.length === 0"
            data-testid="order-add"
            @click="add"
          />
        </div>
      </div>
    </template>

    <div class="mb-4 space-y-1">
      <div class="flex justify-between text-sm">
        <span class="text-muted">{{ t('taxes.allowance') }}</span>
        <span class="tabular-nums" data-testid="allowance-used">
          {{ formatEur(tax.usedCents) }} / {{ formatEur(tax.allowanceCents) }}
        </span>
      </div>
      <UProgress :model-value="usedPct" size="sm" />
      <div class="text-xs text-muted">
        {{ t('taxes.available', { amount: formatEur(tax.allowanceCents - tax.usedCents) }) }}
      </div>
    </div>

    <UAlert
      v-if="tax.exceedsAllowance"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      class="mb-4"
      :title="
        t('taxes.exceeds', {
          total: formatEur(tax.totalCents),
          allowance: formatEur(tax.allowanceCents),
        })
      "
      data-testid="allowance-warning"
    />

    <p v-if="tax.orders.length === 0" class="text-sm text-muted">–</p>
    <ul v-else class="divide-y divide-default text-sm" data-testid="order-list">
      <li
        v-for="order in tax.orders"
        :key="order.id"
        class="row-hover flex flex-wrap items-center justify-between gap-2 py-2"
      >
        <span class="min-w-0">
          <span class="block font-medium">{{ order.institutionName }}</span>
          <span class="text-xs text-muted">
            {{ t('taxes.income') }}: {{ formatEur(order.taxableIncomeCents) }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <span class="tabular-nums" data-testid="order-used">
            {{
              t('taxes.used', {
                used: formatEur(order.usedCents),
                amount: formatEur(order.amountCents),
              })
            }}
          </span>
          <UButton
            icon="i-lucide-pencil"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="t('common.edit')"
            @click="edit(order)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="t('common.delete')"
            data-testid="order-delete"
            @click="remove(order.id)"
          />
        </span>
      </li>
    </ul>

    <UModal v-model:open="formOpen" :title="t('taxes.addOrder')">
      <template #body>
        <div class="space-y-3" data-testid="order-form">
          <UFormField :label="t('taxes.broker')" required>
            <USelect
              v-model="institutionId"
              :items="
                editingId
                  ? tax.orders
                      .filter((o) => o.id === editingId)
                      .map((o) => ({ value: o.institutionId, label: o.institutionName }))
                  : brokers
              "
              :disabled="!!editingId"
              class="w-full"
              data-testid="order-broker"
            />
          </UFormField>
          <UFormField :label="t('taxes.amount')" required>
            <UInputNumber
              v-model="amount"
              :min="0"
              :step="1"
              :format-options="{ style: 'currency', currency: 'EUR' }"
              class="w-full"
              data-testid="order-amount"
            />
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
            @click="formOpen = false"
          />
          <UButton
            :disabled="!institutionId || amount === undefined"
            :label="t('common.save')"
            data-testid="order-save"
            @click="save"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
