<script setup lang="ts">
import type { AccountDto, InstrumentDto } from '@finance/shared'

/** Buchungen (US3): filter bar plus the bookings table. */
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
}))
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.investments') }}</h1>
    <InvestmentsNav />
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-testid="tx-filters">
      <USelect v-model="type" :items="typeItems" size="sm" data-testid="tx-filter-type" />
      <USelect v-model="depot" :items="depotItems" size="sm" data-testid="tx-filter-depot" />
      <USelectMenu
        v-model="instrumentId"
        :items="instrumentItems"
        value-key="value"
        size="sm"
        class="col-span-2 sm:col-span-1"
        data-testid="tx-filter-security"
      />
      <UInput
        v-model="from"
        type="date"
        size="sm"
        :aria-label="t('investments.tx.from')"
        data-testid="tx-filter-from"
      />
      <UInput
        v-model="to"
        type="date"
        size="sm"
        :aria-label="t('investments.tx.to')"
        data-testid="tx-filter-to"
      />
    </div>
    <TransactionsTable :filters="filters" />
  </section>
</template>
