<script setup lang="ts">
import type { AccountDto, InstrumentDto } from '@finance/shared'

/** Buchungen (US3): "Filtern" panel with active count (003 FR-014) plus the bookings table. */
const { t } = useI18n()
useHead({ title: t('investments.views.transactions') })
const { accountsParam } = useAccountFilter()

const ALL = 'all'
const TYPES = [
  'buy',
  'sell',
  'dividend',
  'interest',
  'fee',
  'tax',
  'split',
  'deposit',
  'withdrawal',
] as const
const type = ref<string>(ALL)
const depot = ref<string>(ALL)
const instrumentId = ref<string>(ALL)
const from = ref('')
const to = ref('')
const min = ref('')
const max = ref('')
const toCents = (value: string) => {
  const parsed = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(parsed) ? undefined : Math.round(parsed * 100)
}
/** Active filters shown on the "Filtern" button (003 FR-014). */
const activeCount = computed(
  () =>
    [
      type.value !== ALL,
      depot.value !== ALL,
      instrumentId.value !== ALL,
      !!from.value || !!to.value,
      !!min.value || !!max.value,
    ].filter(Boolean).length,
)
function reset(): void {
  type.value = ALL
  depot.value = ALL
  instrumentId.value = ALL
  from.value = ''
  to.value = ''
  min.value = ''
  max.value = ''
}

const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})
const { data: instruments } = await useApi<InstrumentDto[]>('/api/instruments', {
  key: 'instruments',
  default: () => [],
})

const typeItems = computed(() => [
  { value: ALL, label: t('investments.all') },
  ...TYPES.map((value) => ({ value, label: t(`transactionTypes.${value}`) })),
])
const depotItems = computed(() => [
  { value: ALL, label: t('investments.tx.allDepots') },
  ...(accounts.value ?? [])
    .filter((a) => a.type === 'depot')
    .map((a) => ({ value: a.id, label: a.name })),
])
const instrumentItems = computed(() => [
  { value: ALL, label: t('investments.tx.allSecurities') },
  ...(instruments.value ?? []).map((i) => ({ value: i.id, label: i.name })),
])

const filters = computed(() => ({
  accounts: depot.value !== ALL ? depot.value : accountsParam.value,
  type: type.value === ALL ? undefined : type.value,
  instrumentId: instrumentId.value === ALL ? undefined : instrumentId.value,
  from: from.value || undefined,
  to: to.value || undefined,
  minCents: toCents(min.value),
  maxCents: toCents(max.value),
}))
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.investments') }}</h1>
    <div class="flex justify-end">
      <UPopover :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-list-filter"
          variant="soft"
          color="neutral"
          :label="t('txws.filter')"
          data-testid="tx-filter-button"
        >
          <template v-if="activeCount > 0" #trailing>
            <UBadge :label="String(activeCount)" size="sm" data-testid="tx-filter-count" />
          </template>
        </UButton>
        <template #content>
          <div class="grid w-[min(92vw,22rem)] gap-3 p-4" data-testid="tx-filters">
            <UFormField :label="t('investments.tx.type')">
              <USelect
                v-model="type"
                :items="typeItems"
                class="w-full"
                data-testid="tx-filter-type"
              />
            </UFormField>
            <UFormField :label="t('investments.tx.depot')">
              <USelect
                v-model="depot"
                :items="depotItems"
                class="w-full"
                data-testid="tx-filter-depot"
              />
            </UFormField>
            <UFormField :label="t('investments.columns.name')">
              <USelectMenu
                v-model="instrumentId"
                :items="instrumentItems"
                value-key="value"
                class="w-full"
                data-testid="tx-filter-security"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-2">
              <UFormField :label="t('investments.tx.from')">
                <UInput v-model="from" type="date" data-testid="tx-filter-from" />
              </UFormField>
              <UFormField :label="t('investments.tx.to')">
                <UInput v-model="to" type="date" data-testid="tx-filter-to" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UFormField :label="t('txws.filters.minAmount')">
                <UInput v-model="min" inputmode="decimal" data-testid="tx-filter-min" />
              </UFormField>
              <UFormField :label="t('txws.filters.maxAmount')">
                <UInput v-model="max" inputmode="decimal" data-testid="tx-filter-max" />
              </UFormField>
            </div>
            <UButton
              variant="ghost"
              color="neutral"
              :label="t('txws.filters.reset')"
              class="justify-self-start"
              @click="reset"
            />
          </div>
        </template>
      </UPopover>
    </div>
    <TransactionsTable :filters="filters" />
  </section>
</template>
