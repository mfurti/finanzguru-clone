<script setup lang="ts">
import { formatDate, type TagDto, type TransactionListItem } from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * Booking side panel like the reference (007 US1, research R3): header with avatar, name,
 * amount and date; account; category (opens the category window); details; type; switches
 * for review status and transfer; tags; note (saved on blur); delete.
 */
const props = defineProps<{ item: TransactionListItem; tags: TagDto[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: []; category: []; delete: [] }>()
const { t } = useI18n()
const toast = useToast()

const name = computed(
  () => props.item.counterparty ?? props.item.purpose ?? t(`transactionTypes.${props.item.type}`),
)
const typeItems = computed(() =>
  ['income', 'expense', 'transfer', 'fee', 'interest', 'tax', 'dividend', 'deposit', 'withdrawal']
    .concat(props.item.type)
    .filter((value, index, all) => all.indexOf(value) === index)
    .map((value) => ({ value, label: t(`transactionTypes.${value}`) })),
)
const tagItems = computed(() => props.tags.map((tag) => ({ label: tag.name, value: tag.id })))

const note = ref(props.item.note ?? '')
watch(
  () => [props.item.id, props.item.note] as const,
  () => {
    note.value = props.item.note ?? ''
  },
)

/** PATCH the booking and let the table reload. */
async function patch(body: Record<string, unknown>): Promise<void> {
  try {
    await apiFetch(`/api/transactions/${props.item.id}`, { method: 'PATCH', body })
    emit('changed')
  } catch (error) {
    const message =
      error instanceof FetchError ? (error.data?.message ?? error.statusMessage) : undefined
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  }
}

const unreviewed = computed({
  get: () => props.item.reviewStatus === 'unreviewed',
  set: (value: boolean) => patch({ reviewStatus: value ? 'unreviewed' : 'reviewed' }),
})
const transfer = computed({
  get: () => props.item.type === 'transfer',
  // Off: back to income or expense by sign.
  set: (value: boolean) =>
    patch({ type: value ? 'transfer' : props.item.amountCents >= 0 ? 'income' : 'expense' }),
})
function saveNote(): void {
  const next = note.value.trim()
  if (next === (props.item.note ?? '')) return
  void patch({ note: next })
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :title="name"
    :ui="{ content: 'w-full sm:max-w-md' }"
    :close="{ 'aria-label': t('panel.close') }"
  >
    <template #header>
      <div class="flex w-full items-start gap-3" data-testid="booking-panel-header">
        <Avatar :name="name" size="lg" />
        <div class="min-w-0 flex-1">
          <h2 class="truncate font-semibold" :title="name">{{ name }}</h2>
          <p class="text-sm text-muted">{{ formatDate(item.bookingDate) }}</p>
        </div>
        <Money :cents="item.amountCents" signed class="text-lg font-semibold whitespace-nowrap" />
        <UButton
          icon="i-lucide-x"
          variant="ghost"
          color="neutral"
          size="sm"
          :aria-label="t('panel.close')"
          @click="open = false"
        />
      </div>
    </template>
    <template #body>
      <div class="space-y-5 text-sm" data-testid="booking-panel">
        <section class="space-y-1">
          <h3 class="text-xs font-medium text-muted uppercase">{{ t('panel.account') }}</h3>
          <p>{{ item.accountName }}</p>
          <p v-if="item.institutionName" class="text-muted">{{ item.institutionName }}</p>
        </section>

        <section class="space-y-1">
          <h3 class="text-xs font-medium text-muted uppercase">{{ t('panel.category') }}</h3>
          <UButton
            variant="outline"
            color="neutral"
            size="sm"
            :label="item.categoryName ?? t('rules.category')"
            trailing-icon="i-lucide-chevron-right"
            data-testid="panel-category"
            @click="emit('category')"
          />
        </section>

        <section class="space-y-2">
          <h3 class="text-xs font-medium text-muted uppercase">{{ t('panel.details') }}</h3>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <template v-if="item.counterparty">
              <dt class="text-muted">
                {{ item.amountCents >= 0 ? t('panel.from') : t('panel.to') }}
              </dt>
              <dd class="break-words">{{ item.counterparty }}</dd>
            </template>
            <template v-if="item.counterpartyIban">
              <dt class="text-muted">{{ t('panel.iban') }}</dt>
              <dd class="font-mono text-xs break-all">{{ item.counterpartyIban }}</dd>
            </template>
            <template v-if="item.purpose">
              <dt class="text-muted">{{ t('panel.purpose') }}</dt>
              <dd class="break-words" data-testid="panel-purpose">{{ item.purpose }}</dd>
            </template>
            <dt class="text-muted">{{ t('panel.amount') }}</dt>
            <dd><Money :cents="item.amountCents" signed /></dd>
            <dt class="text-muted">{{ t('panel.date') }}</dt>
            <dd>{{ formatDate(item.bookingDate) }}</dd>
          </dl>
        </section>

        <UFormField :label="t('panel.type')">
          <USelect
            :model-value="item.type"
            :items="typeItems"
            class="w-full"
            data-testid="panel-type"
            @update:model-value="(value: string) => patch({ type: value })"
          />
        </UFormField>

        <div class="space-y-3">
          <USwitch
            v-model="unreviewed"
            :label="t('panel.unreviewed')"
            data-testid="panel-unreviewed"
          />
          <USwitch v-model="transfer" :label="t('panel.transfer')" data-testid="panel-transfer" />
        </div>

        <UFormField v-if="tags.length > 0" :label="t('panel.tags')">
          <USelectMenu
            :model-value="item.tags.map((tag) => tag.id)"
            :items="tagItems"
            value-key="value"
            multiple
            class="w-full"
            data-testid="panel-tags"
            @update:model-value="(value: string[]) => patch({ tagIds: value })"
          />
        </UFormField>

        <UFormField :label="t('panel.notes')">
          <UTextarea
            v-model="note"
            :placeholder="t('panel.notePlaceholder')"
            :maxlength="1000"
            autoresize
            class="w-full"
            data-testid="panel-note"
            @blur="saveNote"
          />
        </UFormField>

        <UButton
          icon="i-lucide-trash-2"
          variant="soft"
          color="error"
          :label="t('panel.delete')"
          data-testid="panel-delete"
          @click="emit('delete')"
        />
      </div>
    </template>
  </USlideover>
</template>
