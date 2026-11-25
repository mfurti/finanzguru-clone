<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import {
  formatDate,
  TRANSACTION_PAGE_SIZES,
  type TagDto,
  type TransactionExportColumn,
  type CategorizeResult,
  type TransactionListItem,
  type TransactionPage,
} from '@finance/shared'
import type { BookingFixed, BookingQueryState } from '~/composables/useBookingQuery'

/**
 * Bookings workspace (003 US1, FR-004/FR-005): search, filter panel, column
 * choice, tags, export, sortable columns, multi-select with bulk actions,
 * editable category chip, delete with undo, 25/50/100 rows per page.
 * Reused on account, category and Sankey pages with `fixed` filters.
 */
const props = withDefaults(
  defineProps<{
    routeSync?: boolean
    fixed?: BookingFixed
    /** Hide the toolbar parts a page does not need (e.g. category filter on a category page). */
    compact?: boolean
  }>(),
  { routeSync: false, fixed: () => ({}), compact: false },
)
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()

/** `refresh()` for the page (tiles changed bookings); bound after the data is loaded. */
let reload: () => Promise<void> = async () => {}
defineExpose({ refresh: () => reload() })

const { state, set, filter, listQuery, activeCount } = useBookingQuery({
  routeSync: props.routeSync,
  fixed: () => props.fixed,
})

// Search box: applied 300 ms after the last keystroke.
const search = ref(state.value.q)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => set({ q: value.trim() }), 300)
})
watch(
  () => state.value.q,
  (value) => {
    if (value !== search.value.trim()) search.value = value
  },
)
onBeforeUnmount(() => clearTimeout(timer))

const { data, refresh, status } = await useApi<TransactionPage>('/api/transactions', {
  query: listQuery,
  default: () => ({ items: [], total: 0, page: 1, pageSize: 50, sumCents: 0 }),
})
const { colorOf, iconOf } = await useCategoryAppearance()
const { data: tags, refresh: refreshTags } = await useApi<TagDto[]>('/api/tags', {
  key: 'tags',
  default: () => [],
})

/** After any change: reload this table, counts and anything else keyed on bookings. */
async function changed(): Promise<void> {
  rowSelection.value = {}
  await Promise.all([refresh(), refreshNuxtData('unreviewed-count'), refreshTags()])
  emit('changed')
}

reload = changed

// ---- Selection -------------------------------------------------------------
const rowSelection = ref<Record<string, boolean>>({})
const selectedIds = computed(() =>
  Object.entries(rowSelection.value)
    .filter(([, on]) => on)
    .map(([id]) => id),
)
watch(listQuery, () => (rowSelection.value = {}), { deep: true })

// ---- Columns ---------------------------------------------------------------
type ColumnId = 'name' | 'date' | 'category' | 'tags' | 'account' | 'purpose' | 'amount'
const HIDEABLE: ColumnId[] = ['date', 'category', 'tags', 'account', 'purpose']
const STORAGE_KEY = 'vk.bookings.columns'
const columnVisibility = ref<Record<string, boolean>>(initialColumnVisibility(null))
onMounted(() => {
  try {
    columnVisibility.value = initialColumnVisibility(localStorage.getItem(STORAGE_KEY))
  } catch {
    // Storage unavailable: keep defaults.
  }
})
watch(
  columnVisibility,
  (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      // Ignore.
    }
  },
  { deep: true },
)
const visibleColumns = computed(() =>
  (['name', 'date', 'category', 'tags', 'account', 'purpose', 'amount'] as ColumnId[]).filter(
    (id) => columnVisibility.value[id] !== false,
  ),
)
const columnMenu = computed(() =>
  HIDEABLE.map((id) => ({
    label: t(`txws.col.${id}`),
    type: 'checkbox' as const,
    checked: columnVisibility.value[id] !== false,
    onUpdateChecked: (checked: boolean) =>
      (columnVisibility.value = { ...columnVisibility.value, [id]: checked }),
    onSelect: (event: Event) => event.preventDefault(),
  })),
)

const UCheckbox = resolveComponent('UCheckbox')
const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const Money = resolveComponent('Money')
const Avatar = resolveComponent('Avatar')
const CategoryIcon = resolveComponent('CategoryIcon')
const SortHeader = resolveComponent('SortHeader')

const sortable =
  (id: BookingQueryState['sort'], label: string, align: 'left' | 'right' = 'left') =>
  () =>
    h(SortHeader, {
      label,
      align,
      dir: state.value.sort === id ? state.value.dir : null,
      'data-testid': `sort-${id}`,
      onToggle: () =>
        set(
          state.value.sort === id
            ? { sort: id, dir: state.value.dir === 'desc' ? 'asc' : 'desc' }
            : { sort: id, dir: id === 'date' || id === 'amount' ? 'desc' : 'asc' },
        ),
    })

const columns = computed<TableColumn<TransactionListItem>[]>(() => [
  {
    id: 'select',
    header: ({ table }) =>
      h(UCheckbox, {
        modelValue: table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : table.getIsAllPageRowsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value),
        'aria-label': t('txws.selectAll'),
        'data-testid': 'select-all',
      }),
    cell: ({ row }) =>
      h(UCheckbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(!!value),
        'aria-label': t('txws.col.select'),
        'data-testid': 'select-row',
      }),
    enableHiding: false,
  },
  {
    id: 'name',
    header: sortable('counterparty', t('txws.col.name')),
    cell: ({ row }) => {
      const item = row.original
      const name = item.counterparty ?? item.purpose ?? t(`transactionTypes.${item.type}`)
      return h('div', { class: 'flex min-w-48 items-center gap-3' }, [
        h(Avatar, { name, size: 'sm' }),
        h('div', { class: 'min-w-0' }, [
          h('div', { class: 'flex items-center gap-1.5 font-medium' }, [
            isOpen(item)
              ? h('span', {
                  class: 'size-2 shrink-0 rounded-full bg-primary',
                  title: t('txws.unreviewedDot'),
                  'data-testid': 'unreviewed-dot',
                })
              : null,
            h('span', { class: 'max-w-40 truncate xl:max-w-56', title: name }, name),
          ]),
          // Purpose line only on wide screens and when it has no column of its own.
          item.counterparty && item.purpose && columnVisibility.value.purpose === false
            ? h(
                'div',
                {
                  class: 'hidden max-w-56 truncate text-xs text-muted xl:block',
                  title: item.purpose,
                },
                item.purpose,
              )
            : null,
          // Date under the name when the date column is hidden.
          columnVisibility.value.date === false
            ? h('div', { class: 'text-xs text-muted' }, formatDate(item.bookingDate))
            : null,
        ]),
      ])
    },
  },
  {
    id: 'date',
    header: sortable('date', t('txws.col.date')),
    cell: ({ row }) =>
      h('span', { class: 'whitespace-nowrap' }, formatDate(row.original.bookingDate)),
  },
  {
    id: 'category',
    header: sortable('category', t('txws.col.category')),
    cell: ({ row }) =>
      h(
        'button',
        {
          type: 'button',
          class:
            'inline-flex max-w-48 cursor-pointer items-center gap-1.5 rounded-full border border-default px-2 py-0.5 text-xs transition-colors hover:bg-elevated',
          'aria-label': `${t('txws.col.category')}: ${row.original.categoryName ?? t('rules.category')}`,
          'data-testid': 'category-chip',
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            openCategory([row.original.id])
          },
        },
        row.original.categoryId
          ? [
              h(CategoryIcon, {
                icon: iconOf(row.original.categoryId),
                color: colorOf(row.original.categoryId),
                size: 'sm',
                class: 'size-4! rounded-full',
              }),
              h('span', { class: 'truncate' }, row.original.categoryName),
            ]
          : [h('span', { class: 'text-muted' }, t('rules.category'))],
      ),
  },
  {
    id: 'tags',
    header: t('txws.col.tags'),
    // Narrow screens: Eigenschaften give way so Betrag stays visible (007 R1).
    meta: { class: { th: 'hidden xl:table-cell', td: 'hidden xl:table-cell' } },
    cell: ({ row }) =>
      h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        row.original.tags.map((item) =>
          h(UBadge, {
            label: item.name,
            variant: 'soft',
            color: 'neutral',
            size: 'sm',
            style: { boxShadow: `inset 3px 0 0 ${categoryHex(item.color)}` },
          }),
        ),
      ),
  },
  {
    id: 'account',
    header: sortable('account', t('txws.col.account')),
    cell: ({ row }) =>
      h('span', { class: 'whitespace-nowrap text-muted' }, row.original.accountName),
  },
  {
    id: 'purpose',
    header: t('txws.col.purpose'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'block max-w-64 truncate text-muted', title: row.original.purpose ?? '' },
        row.original.purpose ?? '–',
      ),
  },
  {
    id: 'amount',
    header: sortable('amount', t('txws.col.amount'), 'right'),
    meta: { class: { th: 'text-right', td: 'text-right' } },
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-end gap-1 whitespace-nowrap' }, [
        h(Money, { cents: row.original.amountCents, signed: true, class: 'font-medium' }),
        h(UButton, {
          icon: 'i-lucide-trash-2',
          size: 'xs',
          variant: 'ghost',
          color: 'neutral',
          class:
            'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100',
          'aria-label': t('txws.delete'),
          'data-testid': 'delete-row',
          onClick: () => remove([row.original.id]),
        }),
      ]),
  },
])

const isOpen = (item: TransactionListItem) => item.reviewStatus === 'unreviewed' && !item.categoryId

// ---- Actions ---------------------------------------------------------------
async function bulk(payload: Record<string, unknown>) {
  return apiFetch<{ affected: number; undoToken?: string }>('/api/transactions/bulk', {
    method: 'POST',
    body: payload,
  })
}

/** Category change goes through the large window: list, scope and "merken" (007 US1). */
const categoryTargets = ref<TransactionListItem[]>([])
const categoryOpen = ref(false)
/** Side panel of one booking (007 US1); keeps the last copy if a reload filters it out. */
const panelId = ref<string | null>(null)
const panelOpen = ref(false)
const panelLast = ref<TransactionListItem | null>(null)
const panelItem = computed(() => {
  const found = (data.value?.items ?? []).find((item) => item.id === panelId.value)
  return found ?? panelLast.value
})
watch(panelItem, (value) => {
  if (value) panelLast.value = value
})
function openPanel(_event: Event, row: { original: TransactionListItem }): void {
  panelLast.value = row.original
  panelId.value = row.original.id
  panelOpen.value = true
}
async function deleteFromPanel(): Promise<void> {
  if (!panelId.value) return
  panelOpen.value = false
  await remove([panelId.value])
}

function openCategory(ids: string[]): void {
  const items = (data.value?.items ?? []).filter((item) => ids.includes(item.id))
  if (items.length === 0) return
  categoryTargets.value = items
  categoryOpen.value = true
}
async function categoryChanged(suggestion: CategorizeResult['suggestion']): Promise<void> {
  rowSelection.value = {}
  await changed()
  if (!suggestion) return
  suggestionsRefresh.value++
  // Offer the rule right where the owner just categorized (006 US2).
  toast.add({
    title: t('rules.suggest'),
    description: suggestion.counterparty,
    icon: 'i-lucide-lightbulb',
    duration: 10_000,
    actions: [
      {
        label: t('rules.accept'),
        onClick: async () => {
          const result = await apiFetch<{ applied: number }>(
            `/api/rules/suggestions/${suggestion.id}/accept`,
            { method: 'POST' },
          )
          toast.add({ title: t('rules.applied', { n: result.applied }), color: 'success' })
          suggestionsRefresh.value++
          await changed()
        },
      },
    ],
  })
}
/** Bumped when a category change produced a rule suggestion (006 US2). */
const suggestionsRefresh = useState('rule-suggestions-refresh', () => 0)

async function remove(ids: string[]): Promise<void> {
  const result = await bulk({ ids, action: 'delete' })
  await changed()
  if (!result.undoToken) return
  toast.add({
    title: t('txws.deleted', { n: result.affected }),
    icon: 'i-lucide-trash-2',
    duration: 10_000,
    actions: [
      {
        label: t('txws.undo'),
        color: 'neutral',
        variant: 'outline',
        onClick: async () => {
          await apiFetch('/api/transactions/restore', {
            method: 'POST',
            body: { undoToken: result.undoToken },
          })
          toast.add({ title: t('txws.restored'), icon: 'i-lucide-undo-2' })
          await changed()
        },
      },
    ],
  })
}

const exportUrl = computed(() => {
  const map: Record<ColumnId, TransactionExportColumn[]> = {
    name: ['counterparty', 'purpose'],
    date: ['date'],
    category: ['category'],
    tags: ['tags'],
    account: ['account'],
    // The purpose is already part of the name in the export.
    purpose: [],
    amount: ['amount'],
  }
  const ordered: ColumnId[] = ['date', 'name', 'category', 'tags', 'account', 'purpose', 'amount']
  const cols = ordered.filter((id) => visibleColumns.value.includes(id)).flatMap((id) => map[id])
  const params = new URLSearchParams({
    ...filter.value,
    sort: state.value.sort,
    dir: state.value.dir,
    columns: cols.join(','),
  })
  return `/api/transactions/export.csv?${params}`
})

const tagManagerOpen = ref(false)
const pageSizeItems = TRANSACTION_PAGE_SIZES.map((size) => ({ label: String(size), value: size }))
const rangeLabel = computed(() => {
  const total = data.value?.total ?? 0
  if (total === 0) return ''
  const from = (state.value.page - 1) * state.value.pageSize + 1
  return t('txws.rows', {
    from,
    to: Math.min(total, from + state.value.pageSize - 1),
    total,
  })
})
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }" data-testid="bookings">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('txws.search')"
          class="w-full sm:w-64"
          data-testid="transactions-search"
        />
        <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
          <BookingFilterPanel
            :state="state"
            :active="activeCount"
            :hide-categories="!!fixed.categoryIds"
            :hide-period="!!fixed.from"
            :tags="tags ?? []"
            :show-accounts="routeSync && !fixed.accounts"
            @apply="set"
          />
          <UDropdownMenu :items="columnMenu" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-columns-3"
              variant="soft"
              color="neutral"
              :label="t('txws.columns')"
              data-testid="columns-menu"
            />
          </UDropdownMenu>
          <UButton
            v-if="!compact"
            icon="i-lucide-tags"
            variant="soft"
            color="neutral"
            :label="t('txws.tags')"
            data-testid="tags-button"
            @click="tagManagerOpen = true"
          />
          <UButton
            v-if="!compact"
            icon="i-lucide-shapes"
            variant="soft"
            color="neutral"
            :label="t('txws.categories')"
            to="/settings/categories"
          />
          <UButton
            icon="i-lucide-download"
            variant="soft"
            color="neutral"
            :label="t('txws.export')"
            :href="exportUrl"
            external
            download
            data-testid="transactions-export"
          />
        </div>
      </div>
    </template>

    <BookingPanel
      v-if="panelItem"
      v-model:open="panelOpen"
      :item="panelItem"
      :tags="tags ?? []"
      @changed="changed"
      @category="openCategory([panelItem.id])"
      @delete="deleteFromPanel"
    />

    <CategoryWindow
      v-if="categoryTargets.length > 0"
      v-model:open="categoryOpen"
      :items="categoryTargets"
      @done="categoryChanged"
    />

    <BulkBar
      v-if="selectedIds.length > 0"
      :ids="selectedIds"
      :tags="tags ?? []"
      @set-category="openCategory(selectedIds)"
      @delete="remove(selectedIds)"
      @done="changed"
    />

    <EmptyState
      v-if="(data?.items.length ?? 0) === 0 && status !== 'pending'"
      :title="t('txws.empty')"
      icon="i-lucide-list"
    />
    <UTable
      v-else
      v-model:row-selection="rowSelection"
      v-model:column-visibility="columnVisibility"
      :data="data?.items ?? []"
      :columns="columns"
      :get-row-id="(row: TransactionListItem) => row.id"
      :loading="status === 'pending'"
      :ui="{ tr: 'group/row cursor-pointer', td: 'py-2.5' }"
      data-testid="transactions-table"
      @select="openPanel"
    />

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div class="flex items-center gap-2 text-muted">
          <span>{{ t('txws.perPage') }}</span>
          <USelect
            :model-value="state.pageSize"
            :items="pageSizeItems"
            size="sm"
            class="w-20"
            data-testid="page-size"
            @update:model-value="(value) => set({ pageSize: value as 25 | 50 | 100 })"
          />
          <span data-testid="rows-label">{{ rangeLabel }}</span>
        </div>
        <span class="text-muted">
          {{ t('txws.sum') }}:
          <Money :cents="data?.sumCents ?? 0" signed class="font-medium" />
        </span>
        <UPagination
          v-if="(data?.total ?? 0) > state.pageSize"
          :page="state.page"
          :total="data?.total ?? 0"
          :items-per-page="state.pageSize"
          size="sm"
          @update:page="(page) => set({ page })"
        />
      </div>
    </template>

    <TagManager v-model:open="tagManagerOpen" @changed="changed" />
  </UCard>
</template>
