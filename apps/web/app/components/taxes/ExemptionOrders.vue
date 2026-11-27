<script setup lang="ts">
import { type AccountDto, formatEur, type TaxYearDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

/**
 * Freistellungsaufträge of a year (US4): allowance bar and, like the reference (012 P9), one
 * row per provider with logo, assigned amount (edited in place), used amount with bar and
 * available amount. Providers without a depot can still be added via "Hinzufügen".
 */
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
    .filter(([id]) => !props.tax.providers.some((p) => p.institutionId === id))
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
/** Logo of a provider: the first of its accounts that has one. */
function logoOf(institutionId: string) {
  return (accounts.value ?? []).find((acc) => acc.institutionId === institutionId && acc.logo)?.logo
}
/** Inline edit (012 P9): creates the order when there is none, otherwise updates it. */
const drafts = reactive<Record<string, number | undefined>>({})
async function saveInline(provider: TaxYearDto['providers'][number]): Promise<void> {
  const value = drafts[provider.institutionId]
  if (value === undefined) return
  const amountCents = Math.round(value * 100)
  if (amountCents === provider.amountCents) return
  error.value = null
  try {
    if (provider.orderId) {
      await apiFetch(`/api/taxes/orders/${provider.orderId}`, {
        method: 'PATCH',
        body: { amountCents },
      })
    } else {
      await apiFetch(`/api/taxes/${props.tax.year}/orders`, {
        method: 'POST',
        body: { institutionId: provider.institutionId, amountCents },
      })
    }
    drafts[provider.institutionId] = undefined
    emit('changed')
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? String(cause)
  }
}
const usedPctOf = (provider: TaxYearDto['providers'][number]) =>
  provider.amountCents > 0 ? Math.min(100, (provider.usedCents / provider.amountCents) * 100) : 0

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

    <UAlert v-if="error && !formOpen" color="error" variant="subtle" :title="error" class="mb-3" />
    <div class="overflow-x-auto">
      <table class="w-full min-w-[560px] text-sm" data-testid="provider-table">
        <thead>
          <tr class="text-left text-xs text-muted">
            <th class="py-2 font-medium">{{ t('taxes.provider') }}</th>
            <th class="w-36 py-2 text-right font-medium">{{ t('taxes.assigned') }}</th>
            <th class="w-48 py-2 text-right font-medium">{{ t('taxes.usedCol') }}</th>
            <th class="w-28 py-2 text-right font-medium">{{ t('taxes.availableCol') }}</th>
            <th class="w-10" />
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="provider in tax.providers"
            :key="provider.institutionId"
            :data-institution="provider.institutionId"
            data-testid="provider-row"
          >
            <td class="py-2">
              <span class="flex items-center gap-2">
                <MerchantLogo
                  :name="provider.institutionName"
                  :logo="logoOf(provider.institutionId)"
                  size="sm"
                />
                <span class="min-w-0">
                  <span class="block truncate font-medium">{{ provider.institutionName }}</span>
                  <span class="text-xs text-muted">
                    {{ t('taxes.income') }}: {{ formatEur(provider.taxableIncomeCents) }}
                  </span>
                </span>
              </span>
            </td>
            <td class="py-2 text-right">
              <UInputNumber
                :model-value="drafts[provider.institutionId] ?? provider.amountCents / 100"
                :min="0"
                :step="1"
                :format-options="{ style: 'currency', currency: 'EUR' }"
                size="sm"
                class="w-32"
                :aria-label="t('taxes.assignedFor', { name: provider.institutionName })"
                data-testid="provider-amount"
                @update:model-value="(value) => (drafts[provider.institutionId] = value ?? 0)"
                @blur="saveInline(provider)"
                @keydown.enter="saveInline(provider)"
              />
            </td>
            <td class="py-2">
              <span class="flex items-center justify-end gap-2">
                <span class="tabular-nums" data-testid="order-used">
                  {{ formatEur(provider.usedCents) }}
                </span>
                <UProgress :model-value="usedPctOf(provider)" size="xs" class="w-20" />
              </span>
            </td>
            <td class="py-2 text-right tabular-nums" data-testid="provider-available">
              {{ formatEur(provider.remainingCents) }}
            </td>
            <td class="py-2 text-right">
              <UButton
                v-if="provider.orderId"
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="t('common.delete')"
                data-testid="order-delete"
                @click="remove(provider.orderId)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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
