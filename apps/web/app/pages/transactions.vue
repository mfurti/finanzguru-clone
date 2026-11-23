<script setup lang="ts">
import { formatDate, type TransactionListItem } from '@finance/shared'

/** Transaktionen: all bookings of the selected accounts, searchable and paged. */
const { t } = useI18n()
useHead({ title: t('overview.views.transactions') })
const { accountsParam } = useAccountFilter()

const PAGE_SIZE = 50
const page = ref(1)
const search = ref('')
/** Search term, applied 300 ms after the last keystroke. */
const q = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (q.value = value), 300)
})
onBeforeUnmount(() => clearTimeout(timer))
watch([q, accountsParam], () => (page.value = 1))

const { data } = await useApi<{ items: TransactionListItem[]; total: number }>(
  '/api/transactions',
  {
    query: computed(() => ({
      accounts: accountsParam.value,
      q: q.value.trim() || undefined,
      page: page.value,
      pageSize: PAGE_SIZE,
    })),
    default: () => ({ items: [], total: 0 }),
  },
)

/** Bookings grouped by day, newest first (the API already sorts by date). */
const days = computed(() => {
  const groups = new Map<string, TransactionListItem[]>()
  for (const item of data.value?.items ?? []) {
    groups.set(item.bookingDate, [...(groups.get(item.bookingDate) ?? []), item])
  }
  return [...groups.entries()]
})
</script>

<template>
  <OverviewSection>
    <section class="space-y-4">
      <h1 class="text-xl font-bold">{{ t('overview.views.transactions') }}</h1>
      <UCard data-testid="all-transactions">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2>
              {{ t('overview.views.transactions') }}
              <span class="text-base font-normal text-muted">({{ data!.total }})</span>
            </h2>
            <UInput
              v-model="search"
              icon="i-lucide-search"
              :placeholder="t('header.search')"
              class="w-full sm:w-64"
              data-testid="transactions-search"
            />
          </div>
        </template>
        <EmptyState
          v-if="data!.items.length === 0"
          :title="t('investments.tx.empty')"
          icon="i-lucide-list"
        />
        <div v-else class="space-y-4">
          <section v-for="[day, items] in days" :key="day">
            <h3 class="mb-1 text-xs font-medium text-muted">{{ formatDate(day) }}</h3>
            <ul class="divide-y divide-default text-sm">
              <li
                v-for="item in items"
                :key="item.id"
                class="row-hover flex items-center justify-between gap-3 py-2"
              >
                <span class="min-w-0">
                  <span class="block truncate font-medium">
                    {{ item.counterparty ?? item.purpose ?? t(`transactionTypes.${item.type}`) }}
                  </span>
                  <span class="block truncate text-xs text-muted">
                    {{ item.accountName }}
                    <template v-if="item.categoryName"> · {{ item.categoryName }}</template>
                  </span>
                </span>
                <Money :cents="item.amountCents" signed class="shrink-0" />
              </li>
            </ul>
          </section>
        </div>
        <template v-if="data!.total > PAGE_SIZE" #footer>
          <UPagination v-model:page="page" :total="data!.total" :items-per-page="PAGE_SIZE" />
        </template>
      </UCard>
    </section>
  </OverviewSection>
</template>
