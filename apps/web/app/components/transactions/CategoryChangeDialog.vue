<script setup lang="ts">
import type {
  CategorizeResult,
  RuleDraft,
  TransactionBulkResult,
  TransactionListItem,
} from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * Asks how a category change applies (006 US1, like the reference app): only this booking or
 * all bookings of this recipient, and optionally "Für ähnliche Buchungen merken" with an
 * editable rule. For several selected bookings only the rule option is offered, and only when
 * they share one recipient. Enter saves.
 */
const props = defineProps<{
  items: TransactionListItem[]
  categoryId: string
  categoryName: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [suggestion: CategorizeResult['suggestion']] }>()
const { t } = useI18n()
const toast = useToast()

/** Same normalization as the API's recipient key (NFKC, lower case, single spaces). */
const keyOf = (value: string | null | undefined) =>
  (value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

const single = computed(() => props.items.length === 1)
const first = computed(() => props.items[0])
const recipient = computed(() => keyOf(first.value?.counterparty))
const sameRecipient = computed(
  () =>
    !!recipient.value && props.items.every((item) => keyOf(item.counterparty) === recipient.value),
)

/** Pre-filled rule (006 R2): counterparty, else IBAN, else the purpose after the posting text. */
function draftFor(item: TransactionListItem | undefined): RuleDraft | null {
  if (!item) return null
  const key = keyOf(item.counterparty)
  if (key) return { matchField: 'counterparty', operator: 'contains', pattern: key }
  const iban = (item.counterpartyIban ?? '').replace(/\s+/g, '').toUpperCase()
  if (iban) return { matchField: 'counterparty_iban', operator: 'equals', pattern: iban }
  const parts = (item.purpose ?? '').split(' · ')
  const text = keyOf(parts.length > 1 ? parts.slice(1).join(' ') : parts[0])
    .slice(0, 40)
    .trim()
  return text ? { matchField: 'purpose', operator: 'contains', pattern: text } : null
}

const scope = ref<'single' | 'recipient'>('single')
const remember = ref(false)
const draft = ref<RuleDraft>({ matchField: 'counterparty', operator: 'contains', pattern: '' })
const canRemember = computed(() => (single.value ? !!draftFor(first.value) : sameRecipient.value))
const busy = ref(false)

watch(
  open,
  (value) => {
    if (!value) return
    scope.value = 'single'
    remember.value = false
    draft.value = draftFor(first.value) ?? draft.value
  },
  { immediate: true },
)

const scopeItems = computed(() => [
  {
    value: 'single',
    label: single.value ? t('rules.scopeSingle') : t('rules.updated', { n: props.items.length }),
  },
  ...(single.value && recipient.value
    ? [{ value: 'recipient', label: t('rules.scopeRecipient') }]
    : []),
])

async function save(): Promise<void> {
  if (busy.value) return
  busy.value = true
  const createRule = remember.value && canRemember.value ? draft.value : undefined
  try {
    if (single.value) {
      const result = await apiFetch<CategorizeResult>(`/api/transactions/${first.value!.id}`, {
        method: 'PATCH',
        body: { categoryId: props.categoryId, scope: scope.value, createRule },
      })
      toast.add({
        title: result.ruleId
          ? t('rules.applied', { n: result.ruleApplied })
          : t('rules.updated', { n: result.updated }),
        color: 'success',
      })
      emit('done', result.suggestion)
    } else {
      const result = await apiFetch<TransactionBulkResult>('/api/transactions/bulk', {
        method: 'POST',
        body: {
          ids: props.items.map((item) => item.id),
          action: 'setCategory',
          value: props.categoryId,
          createRule,
        },
      })
      toast.add({
        title: result.ruleId
          ? t('rules.applied', { n: result.ruleApplied ?? 0 })
          : t('rules.updated', { n: result.affected }),
        color: 'success',
      })
      emit('done', null)
    }
    open.value = false
  } catch (error) {
    const message =
      error instanceof FetchError ? (error.data?.message ?? error.statusMessage) : undefined
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('rules.changeCategory')"
    :description="categoryName"
    data-testid="category-change-dialog"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="save">
        <URadioGroup
          v-if="scopeItems.length > 1"
          v-model="scope"
          :items="scopeItems"
          data-testid="category-scope"
        />
        <p v-else-if="!single" class="text-sm text-muted">
          {{ t('rules.updated', { n: items.length }) }}
        </p>
        <div class="space-y-2">
          <UCheckbox
            v-model="remember"
            :disabled="!canRemember"
            :label="t('rules.remember')"
            :description="!canRemember && !single ? t('rules.mixedRecipients') : undefined"
            data-testid="category-remember"
          />
          <RuleFields v-if="remember && canRemember" v-model="draft" />
        </div>
        <button type="submit" class="hidden" aria-hidden="true" tabindex="-1" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton
          :loading="busy"
          :label="t('common.save')"
          data-testid="category-change-save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
