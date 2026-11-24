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
/** Asset-class chips (003 FR-013), shared via useState so other cards can follow. */
const assetClass = useState<AssetClass | 'all'>('positions-asset-class', () => 'all')
/** Column sort (003 FR-012); null = API order (by value). */
const sort = ref<{ id: SortId; dir: 'asc' | 'desc' } | null>(null)
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

type SortId = 'name' | 'price' | 'value' | 'entryValue' | 'gain' | 'allocation' | 'dividends'
const sortValue: Record<SortId, (row: PositionDto) => string | number> = {
  name: (row) => row.name.toLowerCase(),
  price: (row) => row.priceCents ?? 0,
  value: (row) => row.valueCents,
  entryValue: (row) => row.entryValueCents,
  gain: (row) => row.gainCents,
  allocation: (row) => Number(row.allocationPct ?? 0),
  dividends: (row) => row.dividendsCents ?? 0,
}
const sortedPositions = computed(() => {
  const rows = [...(positions.value ?? [])]
  if (!sort.value) return rows
  const { id, dir } = sort.value
  const read = sortValue[id]
  return rows.sort((a, b) => {
    const x = read(a)
    const y = read(b)
    const order = x < y ? -1 : x > y ? 1 : 0
    return dir === 'asc' ? order : -order
  })
})
function toggleSort(id: SortId): void {
  sort.value =
    sort.value?.id === id
      ? { id, dir: sort.value.dir === 'asc' ? 'desc' : 'asc' }
      : { id, dir: id === 'name' ? 'asc' : 'desc' }
}
const SortHeader = resolveComponent('SortHeader')
const Avatar = resolveComponent('Avatar')
const CopyButton = resolveComponent('CopyButton')
const LABELS = computed<Record<SortId, string>>(() => ({
  name: t('investments.columns.name'),
  price: t('investments.columns.price'),
  value: t('investments.columns.value'),
  entryValue: t('investments.columns.entryValue'),
  gain: t('investments.columns.gain'),
  allocation: t('investments.columns.allocation'),
  dividends: t('investments.columns.dividends'),
}))
const header =
  (id: SortId, align: 'left' | 'right' = 'right') =>
  () =>
    h(SortHeader, {
      label: LABELS.value[id],
      align,
      dir: sort.value?.id === id ? sort.value.dir : null,
      'data-testid': `positions-sort-${id}`,
      onToggle: () => toggleSort(id),
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
    header: header('name', 'left'),
    cell: ({ row }) =>
      h('div', { class: 'flex min-w-48 items-center gap-3' }, [
        h(Avatar, { name: row.original.name, size: 'sm' }),
        h('div', { class: 'min-w-0' }, [
          h(
            NuxtLink,
            { to: `/investments/${row.original.instrumentId}`, class: 'font-medium link-hover' },
            () => row.original.name,
          ),
          h('div', { class: 'flex flex-wrap items-center gap-x-1 text-xs text-muted' }, [
            h('span', `${t(`assetClasses.${row.original.assetClass}`)} ·`),
            row.original.wkn
              ? h('span', { class: 'inline-flex items-center' }, [
                  `WKN ${row.original.wkn}`,
                  h(CopyButton, { value: row.original.wkn, label: 'WKN kopieren', class: '-my-1' }),
                ])
              : null,
            h('span', { class: 'inline-flex items-center' }, [
              row.original.isin,
              h(CopyButton, { value: row.original.isin, label: 'ISIN kopieren', class: '-my-1' }),
            ]),
          ]),
        ]),
      ]),
  },
  {
    id: 'price',
    meta: { class: { th: 'text-right' } },
    header: header('price'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.priceCents),
        h('div', { class: 'text-xs' }, [percent(row.original.dayChangePct)]),
      ]),
  },
  {
    id: 'value',
    meta: { class: { th: 'text-right' } },
    header: header('value'),
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
    header: header('entryValue'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.entryValueCents),
        h('div', { class: 'text-xs text-muted' }, `Ø ${number(row.original.avgPrice)} €`),
      ]),
  },
  {
    id: 'gain',
    meta: { class: { th: 'text-right' } },
    header: header('gain'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.gainCents, true),
        h('div', { class: 'text-xs' }, [percent(row.original.gainPct)]),
      ]),
  },
  {
    id: 'allocation',
    meta: { class: { th: 'text-right' } },
    header: header('allocation'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [percent(row.original.allocationPct, false)]),
  },
  {
    id: 'dividends',
    meta: { class: { th: 'text-right' } },
    header: header('dividends'),
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
      label: LABELS.value[column.id as SortId],
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
        <div
          class="flex flex-wrap gap-1.5"
          role="radiogroup"
          :aria-label="t('investments.allAssetClasses')"
          data-testid="asset-class-filter"
        >
          <button
            v-for="item in assetClassItems"
            :key="item.value"
            type="button"
            role="radio"
            :aria-checked="assetClass === item.value"
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            :class="
              assetClass === item.value
                ? 'border-(--ui-text-highlighted) bg-elevated text-highlighted'
                : 'border-default text-muted hover:text-default'
            "
            :data-testid="`asset-chip-${item.value}`"
            @click="assetClass = item.value as AssetClass | 'all'"
          >
            {{ item.value === 'all' ? t('refine.allAssets') : item.label }}
          </button>
        </div>
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
        :data="sortedPositions"
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
