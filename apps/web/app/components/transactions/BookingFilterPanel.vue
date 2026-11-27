<script setup lang="ts">
import { TRANSACTION_TYPES, type AccountDto, type TagDto } from '@finance/shared'
import type { BookingQueryState } from '~/composables/useBookingQuery'

/**
 * "Filter" side panel like the reference (007 US2): Konten, Art der Transaktion, Zeitraum,
 * Kategorie, Tags, Kontobewegungen, Min/Max Betrag and Status. Changes apply on
 * "Ergebnisse anzeigen". With a direction the amounts are typed without sign.
 */
const props = defineProps<{
  state: BookingQueryState
  active: number
  tags: TagDto[]
  hideCategories?: boolean
  hidePeriod?: boolean
  /** Show "Konten" (only where the table follows the global account filter). */
  showAccounts?: boolean
}>()
const emit = defineEmits<{ apply: [patch: Partial<BookingQueryState>, accounts?: string[]] }>()
const { t } = useI18n()
const { items: categoryItems } = await useCategoryOptions()
const { selected: selectedAccounts } = useAccountFilter()
const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})

const open = ref(false)
const draft = reactive({
  accounts: [] as string[],
  review: 'all' as BookingQueryState['review'],
  types: [] as string[],
  categoryIds: [] as string[],
  tagIds: [] as string[],
  direction: 'all' as BookingQueryState['direction'],
  from: '',
  to: '',
  min: '',
  max: '',
})

const euros = (cents: number | null) => (cents === null ? '' : String(cents / 100))
/** Copy the current state into the form whenever the panel opens. */
watch(open, (isOpen) => {
  if (!isOpen) return
  const { minCents, maxCents, direction } = props.state
  Object.assign(draft, {
    accounts: [...selectedAccounts.value],
    review: props.state.review,
    types: [...props.state.types],
    categoryIds: [...props.state.categoryIds],
    tagIds: [...props.state.tagIds],
    direction,
    from: props.state.from,
    to: props.state.to,
    // Outgoing: "Min 10 €" is stored as max −10 €.
    min: direction === 'out' ? euros(maxCents === null ? null : -maxCents) : euros(minCents),
    max: direction === 'out' ? euros(minCents === null ? null : -minCents) : euros(maxCents),
  })
})

const toCents = (value: string) => {
  const parsed = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(parsed) ? null : Math.round(parsed * 100)
}
/** Signed range for the API; with a direction the typed amounts count without sign. */
function range(): { minCents: number | null; maxCents: number | null } {
  const min = toCents(draft.min)
  const max = toCents(draft.max)
  if (draft.direction === 'all') return { minCents: min, maxCents: max }
  const low = min === null ? null : Math.abs(min)
  const high = max === null ? null : Math.abs(max)
  return draft.direction === 'in'
    ? { minCents: low, maxCents: high }
    : { minCents: high === null ? null : -high, maxCents: low === null ? null : -low }
}

function apply(): void {
  emit(
    'apply',
    {
      review: draft.review,
      types: draft.types,
      categoryIds: draft.categoryIds,
      tagIds: draft.tagIds,
      direction: draft.direction,
      from: draft.from,
      to: draft.to,
      ...range(),
    },
    props.showAccounts ? draft.accounts : undefined,
  )
  open.value = false
}
function clear(): void {
  emit(
    'apply',
    {
      review: 'all',
      types: [],
      categoryIds: [],
      tagIds: [],
      direction: 'all',
      from: '',
      to: '',
      minCents: null,
      maxCents: null,
    },
    props.showAccounts ? [] : undefined,
  )
  open.value = false
}

const accountItems = computed(() =>
  (accounts.value ?? [])
    .filter((account) => !account.isHidden && !account.archivedAt)
    .map((account) => ({ label: account.name, value: account.id })),
)
const reviewItems = computed(() => [
  { label: t('txws.filters.reviewAll'), value: 'all' },
  { label: t('txws.filters.reviewUnreviewed'), value: 'unreviewed' },
  { label: t('txws.filters.reviewReviewed'), value: 'reviewed' },
])
const directionItems = computed(() => [
  { label: t('filterPanel.both'), value: 'all' },
  { label: t('filterPanel.in'), value: 'in' },
  { label: t('filterPanel.out'), value: 'out' },
])
const typeItems = computed(() =>
  TRANSACTION_TYPES.map((value) => ({ label: t(`transactionTypes.${value}`), value })),
)
const tagItems = computed(() => props.tags.map((item) => ({ label: item.name, value: item.id })))
</script>

<template>
  <UButton
    icon="i-lucide-list-filter"
    variant="soft"
    color="neutral"
    :label="t('txws.filter')"
    data-testid="filter-button"
    @click="open = true"
  >
    <template v-if="active > 0" #trailing>
      <UBadge :label="String(active)" size="sm" color="primary" data-testid="filter-count" />
    </template>
  </UButton>
  <USlideover
    v-model:open="open"
    side="right"
    :title="t('filterPanel.title')"
    :ui="{ content: 'w-full sm:max-w-md' }"
  >
    <template #body>
      <form
        id="booking-filter-form"
        class="grid gap-4"
        data-testid="filter-panel"
        @submit.prevent="apply"
      >
        <UFormField v-if="showAccounts" :label="t('filterPanel.accounts')">
          <USelectMenu
            v-model="draft.accounts"
            :items="accountItems"
            value-key="value"
            multiple
            :placeholder="t('filterPanel.allAccounts')"
            class="w-full"
            data-testid="filter-accounts"
          />
        </UFormField>
        <UFormField :label="t('filterPanel.type')">
          <USelectMenu
            v-model="draft.types"
            :items="typeItems"
            value-key="value"
            multiple
            :placeholder="t('filterPanel.all')"
            class="w-full"
            data-testid="filter-types"
          />
        </UFormField>
        <UFormField v-if="!hidePeriod" :label="t('filterPanel.period')">
          <div class="grid grid-cols-2 gap-2">
            <UInput
              v-model="draft.from"
              type="date"
              :aria-label="t('txws.filters.from')"
              data-testid="filter-from"
            />
            <UInput
              v-model="draft.to"
              type="date"
              :aria-label="t('txws.filters.to')"
              data-testid="filter-to"
            />
          </div>
        </UFormField>
        <UFormField v-if="!hideCategories" :label="t('filterPanel.category')">
          <USelectMenu
            v-model="draft.categoryIds"
            :items="categoryItems"
            value-key="value"
            multiple
            :placeholder="t('filterPanel.all')"
            class="w-full"
            data-testid="filter-categories"
          />
        </UFormField>
        <UFormField v-if="tagItems.length > 0" :label="t('filterPanel.tags')">
          <USelectMenu
            v-model="draft.tagIds"
            :items="tagItems"
            value-key="value"
            multiple
            class="w-full"
            data-testid="filter-tags"
          />
        </UFormField>
        <UFormField :label="t('filterPanel.direction')">
          <URadioGroup
            v-model="draft.direction"
            :items="directionItems"
            data-testid="filter-direction"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('filterPanel.min')">
            <UInput
              v-model="draft.min"
              inputmode="decimal"
              :placeholder="draft.direction === 'all' ? '-100' : '0'"
              data-testid="filter-min"
            >
              <template #trailing><span class="text-xs text-muted">€</span></template>
            </UInput>
          </UFormField>
          <UFormField :label="t('filterPanel.max')">
            <UInput
              v-model="draft.max"
              inputmode="decimal"
              :placeholder="draft.direction === 'all' ? '0' : '100'"
              data-testid="filter-max"
            >
              <template #trailing><span class="text-xs text-muted">€</span></template>
            </UInput>
          </UFormField>
        </div>
        <UFormField :label="t('filterPanel.status')">
          <URadioGroup v-model="draft.review" :items="reviewItems" data-testid="filter-review" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('filterPanel.reset')"
          data-testid="filter-reset"
          @click="clear"
        />
        <UButton
          type="submit"
          form="booking-filter-form"
          :label="t('filterPanel.apply')"
          data-testid="filter-apply"
        />
      </div>
    </template>
  </USlideover>
</template>
