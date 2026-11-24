<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import {
  type AssetClass,
  POSITION_COLUMNS,
  type PositionColumn,
  type PositionDto,
} from '@finance/shared'

/**
 * Positions card like the reference: title and Positionen/Assetklassen tabs in
 * the header, asset-class filter, Export and Spalten in a toolbar, then the
 * table (or the asset-class list) and sold positions (US4).
 */
/** `accounts` pins the table to one depot (depot detail page, 003 US2). */
const props = defineProps<{ accounts?: string }>()
const { t } = useI18n()
const { accountsParam: globalAccounts } = useAccountFilter()
const accountsParam = computed(() => props.accounts ?? globalAccounts.value)
const assetClass = ref<AssetClass | 'all'>('all')
const view = ref<'positions' | 'assetClasses'>('positions')

const query = computed(() => ({
  accounts: accountsParam.value,
  assetClass: assetClass.value === 'all' ? undefined : assetClass.value,
}))
const { data: positions } = await useApi<PositionDto[]>('/api/investments/positions', {
  query,
  default: () => [],
})
const { data: sold } = await useApi<PositionDto[]>('/api/investments/positions', {
  query: computed(() => ({ ...query.value, status: 'sold' })),
  default: () => [],
})
const { data: all } = await useApi<PositionDto[]>('/api/investments/positions', {
  key: props.accounts ? `positions-all-${props.accounts}` : 'positions-all',
  query: computed(() => ({ accounts: accountsParam.value })),
  default: () => [],
})

const assetClassItems = computed(() => {
  const present = [...new Set((all.value ?? []).map((row) => row.assetClass))]
  return [
    { value: 'all', label: t('investments.allAssetClasses') },
    ...present.map((value) => ({ value, label: t(`assetClasses.${value}`) })),
  ]
})

const Money = resolveComponent('Money')
const Percent = resolveComponent('Percent')
const NuxtLink = resolveComponent('NuxtLink')

const money = (cents: number, signed = false) => h(Money, { cents, signed })
const percent = (value: string | null, signed = true) => h(Percent, { value, signed })
const number = (value: string | null) =>
  value === null ? '–' : Number(value).toLocaleString('de-DE', { maximumFractionDigits: 6 })

const columns = computed<TableColumn<PositionDto>[]>(() => [
  {
    id: 'name',
    header: t('investments.columns.name'),
    cell: ({ row }) =>
      h('div', { class: 'min-w-40' }, [
        h(
          NuxtLink,
          { to: `/investments/${row.original.instrumentId}`, class: 'font-medium link-hover' },
          () => row.original.name,
        ),
        h(
          'div',
          { class: 'text-xs text-muted' },
          `${t(`assetClasses.${row.original.assetClass}`)} · ${row.original.wkn ?? ''} ${row.original.isin}`,
        ),
      ]),
  },
  {
    id: 'price',
    meta: { class: { th: 'text-right' } },
    header: t('investments.columns.price'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.priceCents),
        h('div', { class: 'text-xs' }, [percent(row.original.dayChangePct)]),
      ]),
  },
  {
    id: 'value',
    meta: { class: { th: 'text-right' } },
    header: t('investments.columns.value'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.valueCents),
        h(
          'div',
          { class: 'text-xs text-muted' },
          `${number(row.original.quantity)} ${t('investments.pieces')}`,
        ),
      ]),
  },
  {
    id: 'entryValue',
    meta: { class: { th: 'text-right' } },
    header: t('investments.columns.entryValue'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.entryValueCents),
        h('div', { class: 'text-xs text-muted' }, `Ø ${number(row.original.avgPrice)} €`),
      ]),
  },
  {
    id: 'gain',
    meta: { class: { th: 'text-right' } },
    header: t('investments.columns.gain'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.gainCents, true),
        h('div', { class: 'text-xs' }, [percent(row.original.gainPct)]),
      ]),
  },
  {
    id: 'allocation',
    meta: { class: { th: 'text-right' } },
    header: t('investments.columns.allocation'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [percent(row.original.allocationPct, false)]),
  },
  {
    id: 'dividends',
    meta: { class: { th: 'text-right' } },
    header: t('investments.columns.dividends'),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-right' },
        row.original.dividendsCents ? [money(row.original.dividendsCents)] : '–',
      ),
  },
])

/** Table column → CSV export columns. */
const EXPORT: Record<string, PositionColumn[]> = {
  name: ['name', 'assetClass', 'wkn', 'isin'],
  price: ['price', 'dayChange'],
  value: ['value', 'quantity'],
  entryValue: ['entryValue', 'avgPrice'],
  gain: ['gain', 'gainPct'],
  allocation: ['allocation'],
  dividends: ['dividends'],
}
const columnVisibility = ref<Record<string, boolean>>({})
const visibleIds = computed(() =>
  columns.value.map((column) => column.id!).filter((id) => columnVisibility.value[id] !== false),
)
const visibilityItems = computed(() =>
  columns.value
    .filter((column) => column.id !== 'name')
    .map((column) => ({
      type: 'checkbox' as const,
      label: String(column.header),
      checked: columnVisibility.value[column.id!] !== false,
      onUpdateChecked: (checked: boolean) => {
        columnVisibility.value = { ...columnVisibility.value, [column.id!]: checked }
      },
      onSelect: (event: Event) => event.preventDefault(),
    })),
)
const exportUrl = computed(() => {
  const params = new URLSearchParams()
  params.set(
    'columns',
    visibleIds.value
      .flatMap((id) => EXPORT[id] ?? [])
      .filter((c) => POSITION_COLUMNS.includes(c))
      .join(','),
  )
  if (query.value.accounts) params.set('accounts', query.value.accounts)
  if (query.value.assetClass) params.set('assetClass', query.value.assetClass)
  return `/api/investments/positions.csv?${params.toString()}`
})

const soldOpen = ref(false)
</script>

<template>
  <UCard :ui="{ header: 'p-0 sm:p-0' }" data-testid="positions-card">
    <template #header>
      <div
        class="flex flex-wrap items-end gap-x-8 gap-y-2 border-b border-default px-4 pt-5 sm:px-6 sm:pt-6"
      >
        <h2 class="pb-3">
          {{
            view === 'positions'
              ? t('investments.positions', { n: positions?.length ?? 0 })
              : t('investments.views.assetClasses')
          }}
        </h2>
        <div class="-mb-px flex gap-6" role="tablist">
          <button
            v-for="tab in [
              { label: t('investments.views.positions'), value: 'positions' as const },
              { label: t('investments.views.assetClasses'), value: 'assetClasses' as const },
            ]"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="view === tab.value"
            class="border-b-2 pb-3 text-sm font-medium transition-colors"
            :class="
              view === tab.value
                ? 'border-(--ui-text-highlighted) text-highlighted'
                : 'border-transparent text-muted hover:text-default'
            "
            :data-testid="`positions-view-${tab.value}`"
            @click="view = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </template>

    <AssetClassTable v-if="view === 'assetClasses'" />
    <template v-else>
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <USelect
          v-model="assetClass"
          :items="assetClassItems"
          class="w-full sm:w-60"
          data-testid="asset-class-filter"
        />
        <div class="flex gap-2">
          <UButton
            icon="i-lucide-download"
            variant="soft"
            color="neutral"
            :label="t('investments.export')"
            :href="exportUrl"
            external
            download
            data-testid="positions-export"
          />
          <UDropdownMenu :items="visibilityItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-columns-3"
              variant="soft"
              color="neutral"
              :label="t('investments.columnsButton')"
              data-testid="columns-menu"
            />
          </UDropdownMenu>
        </div>
      </div>

      <EmptyState
        v-if="(positions?.length ?? 0) === 0"
        :title="t('investments.empty')"
        icon="i-lucide-briefcase"
      />
      <UTable
        v-else
        v-model:column-visibility="columnVisibility"
        :data="positions ?? []"
        :columns="columns"
        class="w-full"
        data-testid="positions-table"
      />
    </template>

    <template v-if="view === 'positions' && (sold?.length ?? 0) > 0" #footer>
      <UCollapsible v-model:open="soldOpen">
        <UButton
          variant="ghost"
          color="neutral"
          :trailing-icon="soldOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :label="t('investments.sold', { n: sold!.length })"
          data-testid="sold-toggle"
        />
        <template #content>
          <ul class="divide-y divide-default text-sm" data-testid="sold-list">
            <li
              v-for="row in sold"
              :key="row.instrumentId"
              class="flex items-center justify-between gap-3 py-2"
            >
              <NuxtLink :to="`/investments/${row.instrumentId}`" class="link-hover">{{
                row.name
              }}</NuxtLink>
              <span class="text-right">
                <span class="block text-xs text-muted">{{ t('investments.realized') }}</span>
                <Money :cents="row.realizedCents ?? 0" signed />
              </span>
            </li>
          </ul>
        </template>
      </UCollapsible>
    </template>
  </UCard>
</template>
