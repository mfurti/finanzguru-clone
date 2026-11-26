<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import {
  formatDate,
  type InvestmentTransactionRow,
  type InvestmentTxSort,
  type InvestmentTransactionsResponse,
  TRANSACTION_COLUMNS,
  type TransactionColumn,
} from '@finance/shared'

/**
 * Bookings table (US3): server paging, sortable date/amount, column choice,
 * footer total over all filtered rows, CSV export of the visible columns.
 * Below `sm` it renders one compact card per booking (360 px rule).
 */
const props = defineProps<{
  filters: {
    accounts?: string
    type?: string
    types?: string
    minCents?: number
    maxCents?: number
    instrumentId?: string
    from?: string
    to?: string
  }
}>()
const { t } = useI18n()

const PAGE_SIZE = 50
const page = ref(1)
const sort = ref<InvestmentTxSort>('date')
const dir = ref<'asc' | 'desc'>('desc')
watch(
  () => props.filters,
  () => (page.value = 1),
  { deep: true },
)

const query = computed(() => ({
  ...props.filters,
  sort: sort.value,
  dir: dir.value,
  page: page.value,
  pageSize: PAGE_SIZE,
}))
const { data } = await useApi<InvestmentTransactionsResponse>('/api/investments/transactions', {
  query,
  default: () => ({ items: [], total: 0, sumCents: 0 }),
})

function toggleSort(column: InvestmentTxSort): void {
  if (sort.value === column) dir.value = dir.value === 'desc' ? 'asc' : 'desc'
  else {
    sort.value = column
    dir.value = column === 'name' || column === 'account' || column === 'type' ? 'asc' : 'desc'
  }
}

const Money = resolveComponent('Money')
const NuxtLink = resolveComponent('NuxtLink')
const UButton = resolveComponent('UButton')
const money = (cents: number, signed = false) => h(Money, { cents, signed })
const number = (value: string | null, digits = 6) =>
  value === null ? '–' : Number(value).toLocaleString('de-DE', { maximumFractionDigits: digits })

const sortHeader = (column: InvestmentTxSort, label: string) => () =>
  h(UButton, {
    variant: 'ghost',
    color: 'neutral',
    size: 'xs',
    label,
    class: '-mx-2',
    trailingIcon:
      sort.value !== column
        ? 'i-lucide-arrow-up-down'
        : dir.value === 'asc'
          ? 'i-lucide-arrow-up'
          : 'i-lucide-arrow-down',
    'data-testid': `sort-${column}`,
    onClick: () => toggleSort(column),
  })

const columns = computed<TableColumn<InvestmentTransactionRow>[]>(() => [
  {
    id: 'date',
    header: sortHeader('date', t('investments.tx.date')),
    cell: ({ row }) =>
      h('span', { class: 'whitespace-nowrap' }, formatDate(row.original.bookingDate)),
  },
  {
    id: 'type',
    header: sortHeader('type', t('investments.tx.type')),
    cell: ({ row }) => t(`transactionTypes.${row.original.type}`),
  },
  {
    id: 'name',
    header: sortHeader('name', t('investments.columns.name')),
    cell: ({ row }) =>
      // Truncated so the table fits its box (010 US3); full name in the tooltip.
      h('div', { class: 'w-36 lg:w-44 xl:w-64' }, [
        row.original.instrumentId
          ? h(
              NuxtLink,
              {
                to: `/investments/${row.original.instrumentId}`,
                class: 'block truncate font-medium link-hover',
                title: row.original.instrumentName ?? '',
              },
              () => row.original.instrumentName,
            )
          : h('span', { class: 'text-muted' }, '–'),
        row.original.isin
          ? h(
              'div',
              { class: 'text-xs text-muted' },
              `${row.original.wkn ?? ''} ${row.original.isin}`.trim(),
            )
          : null,
      ]),
  },
  {
    id: 'account',
    header: sortHeader('account', t('investments.tx.depot')),
    // Only on very wide screens; the depot filter above the table covers the rest (010 US3).
    meta: { class: { th: 'hidden 2xl:table-cell', td: 'hidden 2xl:table-cell' } },
    cell: ({ row }) => row.original.accountName,
  },
  {
    id: 'unitPrice',
    header: sortHeader('unitPrice', t('investments.tx.unitPrice')),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        row.original.unitPrice === null ? '–' : `${number(row.original.unitPrice, 4)} €`,
        row.original.quantity
          ? h(
              'div',
              { class: 'text-xs text-muted' },
              `${number(row.original.quantity)} ${t('investments.pieces')}`,
            )
          : null,
      ]),
  },
  {
    id: 'tax',
    header: sortHeader('tax', t('investments.tx.tax')),
    meta: { class: { th: 'hidden xl:table-cell', td: 'hidden xl:table-cell' } },
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-right' },
        row.original.taxCents ? [money(row.original.taxCents)] : '–',
      ),
  },
  {
    id: 'fee',
    header: sortHeader('fee', t('investments.tx.fee')),
    meta: { class: { th: 'hidden xl:table-cell', td: 'hidden xl:table-cell' } },
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-right' },
        row.original.feeCents ? [money(row.original.feeCents)] : '–',
      ),
  },
  {
    id: 'amount',
    header: sortHeader('amount', t('investments.tx.total')),
    cell: ({ row }) =>
      h('div', { class: 'text-right font-medium' }, [money(row.original.amountCents, true)]),
  },
])

/** Table column → CSV columns. */
const EXPORT: Record<string, TransactionColumn[]> = {
  date: ['date'],
  type: ['type'],
  name: ['name', 'wkn', 'isin'],
  account: ['account'],
  unitPrice: ['unitPrice', 'quantity'],
  tax: ['tax'],
  fee: ['fee'],
  amount: ['amount'],
}
/** Menu labels for columns whose header is a sort button. */
const LABELS = computed<Record<string, string>>(() => ({
  type: t('investments.tx.type'),
  name: t('investments.columns.name'),
  account: t('investments.tx.depot'),
  unitPrice: t('investments.tx.unitPrice'),
  tax: t('investments.tx.tax'),
  fee: t('investments.tx.fee'),
}))
const columnVisibility = ref<Record<string, boolean>>({})
const visibleIds = computed(() =>
  columns.value.map((c) => c.id!).filter((id) => columnVisibility.value[id] !== false),
)
const visibilityItems = computed(() =>
  columns.value
    .filter((column) => column.id !== 'date' && column.id !== 'amount')
    .map((column) => ({
      type: 'checkbox' as const,
      label:
        typeof column.header === 'string'
          ? column.header
          : (LABELS.value[column.id!] ?? column.id!),
      checked: columnVisibility.value[column.id!] !== false,
      onUpdateChecked: (checked: boolean) => {
        columnVisibility.value = { ...columnVisibility.value, [column.id!]: checked }
      },
      onSelect: (event: Event) => event.preventDefault(),
    })),
)
const exportUrl = computed(() => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(props.filters)) if (value) params.set(key, value)
  params.set('sort', sort.value)
  params.set('dir', dir.value)
  params.set(
    'columns',
    visibleIds.value
      .flatMap((id) => EXPORT[id] ?? [])
      .filter((c) => TRANSACTION_COLUMNS.includes(c))
      .join(','),
  )
  return `/api/investments/transactions.csv?${params.toString()}`
})
</script>

<template>
  <UCard data-testid="investment-transactions">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">
          {{ t('investments.views.transactions') }}
          <span class="text-sm font-normal text-muted">({{ data!.total }})</span>
        </h2>
        <div class="flex gap-2">
          <UDropdownMenu :items="visibilityItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-columns-3"
              variant="soft"
              color="neutral"
              size="sm"
              :label="t('investments.columnsButton')"
              class="max-sm:hidden"
              data-testid="tx-columns-menu"
            />
          </UDropdownMenu>
          <UButton
            icon="i-lucide-download"
            variant="soft"
            color="neutral"
            size="sm"
            :label="t('investments.export')"
            :href="exportUrl"
            external
            download
            data-testid="tx-export"
          />
        </div>
      </div>
    </template>

    <EmptyState
      v-if="data!.items.length === 0"
      :title="t('investments.tx.empty')"
      icon="i-lucide-list"
    />
    <template v-else>
      <UTable
        v-model:column-visibility="columnVisibility"
        :data="data!.items"
        :columns="columns"
        class="w-full max-md:hidden"
        data-testid="tx-table"
      />
      <ul class="divide-y divide-default text-sm md:hidden" data-testid="tx-cards">
        <li
          v-for="row in data!.items"
          :key="row.id"
          class="row-hover flex items-center justify-between gap-3 py-2"
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{{ row.instrumentName ?? '–' }}</span>
            <span class="text-xs text-muted">
              {{ formatDate(row.bookingDate) }} · {{ t(`transactionTypes.${row.type}`) }}
              <template v-if="row.quantity">
                · {{ number(row.quantity) }} {{ t('investments.pieces') }}</template
              >
            </span>
          </span>
          <Money :cents="row.amountCents" signed />
        </li>
      </ul>
    </template>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UPagination
          v-if="data!.total > PAGE_SIZE"
          v-model:page="page"
          :total="data!.total"
          :items-per-page="PAGE_SIZE"
          size="sm"
        />
        <span v-else />
        <span class="text-sm" data-testid="tx-sum">
          <span class="text-muted">{{ t('investments.tx.sum') }}</span>
          <Money :cents="data!.sumCents" signed class="ml-2 font-semibold" />
        </span>
      </div>
    </template>
  </UCard>
</template>
