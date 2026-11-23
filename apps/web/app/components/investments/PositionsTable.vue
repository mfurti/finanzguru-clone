<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import {
  type AssetClass,
  POSITION_COLUMNS,
  type PositionColumn,
  type PositionDto,
} from '@finance/shared'

/** Open positions with asset filter, column visibility, CSV export and sold positions (US4). */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const assetClass = ref<AssetClass | 'all'>('all')

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
  key: 'positions-all',
  query: computed(() => ({ accounts: accountsParam.value })),
  default: () => [],
})

const chips = computed(() => {
  const present = [...new Set((all.value ?? []).map((row) => row.assetClass))]
  return ['all' as const, ...present]
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
    header: t('investments.columns.price'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.priceCents),
        h('div', { class: 'text-xs' }, [percent(row.original.dayChangePct)]),
      ]),
  },
  {
    id: 'value',
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
    header: t('investments.columns.entryValue'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.entryValueCents),
        h('div', { class: 'text-xs text-muted' }, `Ø ${number(row.original.avgPrice)} €`),
      ]),
  },
  {
    id: 'gain',
    header: t('investments.columns.gain'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [
        money(row.original.gainCents, true),
        h('div', { class: 'text-xs' }, [percent(row.original.gainPct)]),
      ]),
  },
  {
    id: 'allocation',
    header: t('investments.columns.allocation'),
    cell: ({ row }) =>
      h('div', { class: 'text-right' }, [percent(row.original.allocationPct, false)]),
  },
  {
    id: 'dividends',
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
  <UCard data-testid="positions-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">
          {{ t('investments.positions', { n: positions?.length ?? 0 }) }}
        </h2>
        <div class="flex gap-2">
          <UDropdownMenu :items="visibilityItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-columns-3"
              variant="soft"
              color="neutral"
              size="sm"
              :label="t('investments.columnsButton')"
              data-testid="columns-menu"
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
            data-testid="positions-export"
          />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-1">
        <UButton
          v-for="chip in chips"
          :key="chip"
          size="xs"
          :variant="assetClass === chip ? 'solid' : 'soft'"
          :color="assetClass === chip ? 'primary' : 'neutral'"
          :label="chip === 'all' ? t('investments.all') : t(`assetClasses.${chip}`)"
          :data-testid="`chip-${chip}`"
          @click="assetClass = chip"
        />
      </div>
    </template>

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

    <template v-if="(sold?.length ?? 0) > 0" #footer>
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
