<script setup lang="ts">
import { formatDate } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('investments.views.transactions') })
const { accountsParam } = useAccountFilter()

interface Row {
  id: string
  bookingDate: string
  type: string
  amountCents: number
  quantity: string | null
  instrumentId: string | null
  instrumentName: string | null
}

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
const type = ref<(typeof TYPES)[number] | 'all'>('all')
const page = ref(1)
const pageSize = 25
const typeItems = computed(() => [
  { value: 'all', label: t('investments.all') },
  ...TYPES.map((value) => ({ value, label: t(`transactionTypes.${value}`) })),
])
watch([type, accountsParam], () => (page.value = 1))

const { data } = await useApi<{ items: Row[]; total: number }>('/api/investments/transactions', {
  query: computed(() => ({
    accounts: accountsParam.value,
    type: type.value === 'all' ? undefined : type.value,
    page: page.value,
    pageSize,
  })),
  default: () => ({ items: [], total: 0 }),
})
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.investments') }}</h1>
    <InvestmentsNav />
    <UCard data-testid="investment-transactions">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t('investments.views.transactions') }}</h2>
          <USelect v-model="type" :items="typeItems" size="sm" class="w-40" />
        </div>
      </template>
      <EmptyState
        v-if="data!.items.length === 0"
        :title="t('investments.tx.empty')"
        icon="i-lucide-list"
      />
      <ul v-else class="divide-y divide-default text-sm">
        <li
          v-for="row in data!.items"
          :key="row.id"
          class="flex items-center justify-between gap-3 py-2"
        >
          <span class="min-w-0">
            <NuxtLink
              v-if="row.instrumentId"
              :to="`/investments/${row.instrumentId}`"
              class="block truncate font-medium hover:underline"
            >
              {{ row.instrumentName }}
            </NuxtLink>
            <span class="text-xs text-muted">
              {{ formatDate(row.bookingDate) }} · {{ t(`transactionTypes.${row.type}`) }}
              <template v-if="row.quantity">
                · {{ Number(row.quantity).toLocaleString('de-DE') }}
                {{ t('investments.pieces') }}</template
              >
            </span>
          </span>
          <Money :cents="row.amountCents" signed />
        </li>
      </ul>
      <template v-if="data!.total > pageSize" #footer>
        <UPagination v-model:page="page" :total="data!.total" :items-per-page="pageSize" />
      </template>
    </UCard>
  </section>
</template>
