<script setup lang="ts">
import { TRANSACTION_TYPES, type TagDto } from '@finance/shared'
import type { BookingQueryState } from '~/composables/useBookingQuery'

/**
 * "Filtern" popover of the bookings table (FR-004): review state, type,
 * categories, tags, period and amount range. Changes apply on "Anwenden".
 */
const props = defineProps<{
  state: BookingQueryState
  active: number
  tags: TagDto[]
  hideCategories?: boolean
  hidePeriod?: boolean
}>()
const emit = defineEmits<{ apply: [patch: Partial<BookingQueryState>] }>()
const { t } = useI18n()
const { items: categoryItems } = await useCategoryOptions()

const open = ref(false)
const draft = reactive({
  review: 'all' as BookingQueryState['review'],
  types: [] as string[],
  categoryIds: [] as string[],
  tagIds: [] as string[],
  from: '',
  to: '',
  min: '',
  max: '',
})
/** Copy the current state into the form whenever the panel opens. */
watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(draft, {
    review: props.state.review,
    types: [...props.state.types],
    categoryIds: [...props.state.categoryIds],
    tagIds: [...props.state.tagIds],
    from: props.state.from,
    to: props.state.to,
    min: props.state.minCents === null ? '' : String(props.state.minCents / 100),
    max: props.state.maxCents === null ? '' : String(props.state.maxCents / 100),
  })
})

const toCents = (value: string) => {
  const parsed = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(parsed) ? null : Math.round(parsed * 100)
}
function apply(): void {
  emit('apply', {
    review: draft.review,
    types: draft.types,
    categoryIds: draft.categoryIds,
    tagIds: draft.tagIds,
    from: draft.from,
    to: draft.to,
    minCents: toCents(draft.min),
    maxCents: toCents(draft.max),
  })
  open.value = false
}
function clear(): void {
  emit('apply', {
    review: 'all',
    types: [],
    categoryIds: [],
    tagIds: [],
    from: '',
    to: '',
    minCents: null,
    maxCents: null,
  })
  open.value = false
}

const reviewItems = computed(() => [
  { label: t('txws.filters.reviewAll'), value: 'all' },
  { label: t('txws.filters.reviewUnreviewed'), value: 'unreviewed' },
  { label: t('txws.filters.reviewReviewed'), value: 'reviewed' },
])
const typeItems = computed(() =>
  TRANSACTION_TYPES.map((value) => ({ label: t(`transactionTypes.${value}`), value })),
)
const tagItems = computed(() => props.tags.map((item) => ({ label: item.name, value: item.id })))
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-list-filter"
      variant="soft"
      color="neutral"
      :label="t('txws.filter')"
      data-testid="filter-button"
    >
      <template v-if="active > 0" #trailing>
        <UBadge :label="String(active)" size="sm" color="primary" data-testid="filter-count" />
      </template>
    </UButton>
    <template #content>
      <form
        class="grid w-[min(92vw,22rem)] gap-3 p-4"
        data-testid="filter-panel"
        @submit.prevent="apply"
      >
        <UFormField :label="t('txws.filters.review')">
          <URadioGroup
            v-model="draft.review"
            :items="reviewItems"
            orientation="horizontal"
            data-testid="filter-review"
          />
        </UFormField>
        <UFormField :label="t('txws.filters.types')">
          <USelectMenu
            v-model="draft.types"
            :items="typeItems"
            value-key="value"
            multiple
            class="w-full"
            data-testid="filter-types"
          />
        </UFormField>
        <UFormField v-if="!hideCategories" :label="t('txws.filters.categories')">
          <USelectMenu
            v-model="draft.categoryIds"
            :items="categoryItems"
            value-key="value"
            multiple
            class="w-full"
            data-testid="filter-categories"
          />
        </UFormField>
        <UFormField v-if="tagItems.length > 0" :label="t('txws.filters.tags')">
          <USelectMenu
            v-model="draft.tagIds"
            :items="tagItems"
            value-key="value"
            multiple
            class="w-full"
            data-testid="filter-tags"
          />
        </UFormField>
        <div v-if="!hidePeriod" class="grid grid-cols-2 gap-2">
          <UFormField :label="t('txws.filters.from')">
            <UInput v-model="draft.from" type="date" data-testid="filter-from" />
          </UFormField>
          <UFormField :label="t('txws.filters.to')">
            <UInput v-model="draft.to" type="date" data-testid="filter-to" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('txws.filters.minAmount')">
            <UInput
              v-model="draft.min"
              inputmode="decimal"
              placeholder="-100"
              data-testid="filter-min"
            >
              <template #trailing><span class="text-xs text-muted">€</span></template>
            </UInput>
          </UFormField>
          <UFormField :label="t('txws.filters.maxAmount')">
            <UInput
              v-model="draft.max"
              inputmode="decimal"
              placeholder="0"
              data-testid="filter-max"
            >
              <template #trailing><span class="text-xs text-muted">€</span></template>
            </UInput>
          </UFormField>
        </div>
        <div class="flex justify-between gap-2 pt-1">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('txws.filters.reset')"
            data-testid="filter-reset"
            @click="clear"
          />
          <UButton type="submit" :label="t('txws.filters.apply')" data-testid="filter-apply" />
        </div>
      </form>
    </template>
  </UPopover>
</template>
