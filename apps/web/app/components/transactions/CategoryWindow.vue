<script setup lang="ts">
import type {
  CategorizeResult,
  CategoryNode,
  RuleDraft,
  TransactionBulkResult,
  TransactionListItem,
} from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * "Kategorie ändern" like the reference (007 US1, research R2): one large window with search,
 * Alle/Eigene Kategorien, expandable main categories with icons, "Neue Kategorie erstellen",
 * and below the list the 006 options (only this booking or all of this recipient, "Für ähnliche
 * Buchungen merken" with an editable rule). One "Speichern" applies everything.
 */
const props = defineProps<{ items: TransactionListItem[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [suggestion: CategorizeResult['suggestion']] }>()
const { t } = useI18n()
const toast = useToast()
const { tree, refresh: refreshTree } = await useCategoryOptions()
const { colorOf, iconOf } = await useCategoryAppearance()

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

// ---- Category list ---------------------------------------------------------
const query = ref('')
const tab = ref<'all' | 'own'>('all')
const selected = ref<string | null>(null)
const expanded = ref<Set<string>>(new Set())

/** Main categories with the children that match search and tab; a matching main keeps all. */
const groups = computed(() => {
  const text = keyOf(query.value)
  return (tree.value ?? [])
    .map((main) => {
      const children = main.children.filter(
        (child) =>
          (tab.value === 'all' || !child.isDefault) &&
          (!text || keyOf(child.name).includes(text) || keyOf(main.name).includes(text)),
      )
      const mainMatches =
        (tab.value === 'all' || !main.isDefault) && (!text || keyOf(main.name).includes(text))
      return { main, children, visible: mainMatches || children.length > 0 }
    })
    .filter((group) => group.visible)
})
const isOpenGroup = (id: string) => !!query.value.trim() || expanded.value.has(id)
function toggleGroup(id: string): void {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
function choose(node: CategoryNode): void {
  selected.value = node.id
}
const selectedName = computed(() => {
  for (const main of tree.value ?? []) {
    if (main.id === selected.value) return main.name
    const child = main.children.find((item) => item.id === selected.value)
    if (child) return `${main.name} › ${child.name}`
  }
  return ''
})

// ---- New category -----------------------------------------------------------
const creating = ref(false)
const newName = ref('')
const newParent = ref<string | undefined>()
const parentItems = computed(() =>
  (tree.value ?? []).map((main) => ({ label: main.name, value: main.id })),
)
async function createCategory(): Promise<void> {
  const parent = (tree.value ?? []).find((main) => main.id === newParent.value)
  const name = newName.value.trim()
  if (!parent || !name) return
  try {
    const created = await apiFetch<{ id: string }>('/api/categories', {
      method: 'POST',
      body: {
        parentId: parent.id,
        name,
        kind: parent.kind,
        color: parent.color,
        icon: parent.icon,
      },
    })
    await refreshTree()
    expanded.value = new Set([...expanded.value, parent.id])
    selected.value = created.id
    creating.value = false
    newName.value = ''
  } catch (error) {
    const message =
      error instanceof FetchError ? (error.data?.message ?? error.statusMessage) : undefined
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  }
}

// ---- Scope and rule (006) --------------------------------------------------
const scope = ref<'single' | 'recipient'>('single')
const remember = ref(false)
const draft = ref<RuleDraft>({ matchField: 'counterparty', operator: 'contains', pattern: '' })
const canRemember = computed(() => (single.value ? !!draftFor(first.value) : sameRecipient.value))
const busy = ref(false)
/** "Nur diese / alle des Empfängers" only for one booking with a recipient. */
const scopeItems = computed(() =>
  single.value && recipient.value
    ? [
        { value: 'single', label: t('rules.scopeSingle') },
        { value: 'recipient', label: t('rules.scopeRecipient') },
      ]
    : [],
)

watch(
  open,
  (value) => {
    if (!value) return
    query.value = ''
    tab.value = 'all'
    creating.value = false
    scope.value = 'single'
    remember.value = false
    draft.value = draftFor(first.value) ?? draft.value
    selected.value = single.value ? (first.value?.categoryId ?? null) : null
    // Open the group of the current category.
    const parent = (tree.value ?? []).find(
      (main) => main.id === selected.value || main.children.some((c) => c.id === selected.value),
    )
    expanded.value = new Set(parent ? [parent.id] : [])
  },
  { immediate: true },
)

async function save(): Promise<void> {
  if (busy.value || !selected.value) return
  busy.value = true
  const createRule = remember.value && canRemember.value ? draft.value : undefined
  try {
    if (single.value) {
      const result = await apiFetch<CategorizeResult>(`/api/transactions/${first.value!.id}`, {
        method: 'PATCH',
        body: { categoryId: selected.value, scope: scope.value, createRule },
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
          value: selected.value,
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
  <UModal v-model:open="open" :title="t('categoryWindow.title')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div class="space-y-4" data-testid="category-window">
        <div class="flex flex-col gap-2 sm:flex-row">
          <UInput
            v-model="query"
            icon="i-lucide-search"
            :placeholder="t('categoryWindow.search')"
            class="flex-1"
            autofocus
            data-testid="category-search"
          />
          <UButton
            variant="soft"
            color="neutral"
            icon="i-lucide-plus"
            :label="t('categoryWindow.create')"
            data-testid="category-create"
            @click="creating = !creating"
          />
        </div>

        <form
          v-if="creating"
          class="flex flex-col gap-2 rounded-md border border-default p-3 sm:flex-row"
          data-testid="category-create-form"
          @submit.prevent="createCategory"
        >
          <USelect
            v-model="newParent"
            :items="parentItems"
            :placeholder="t('categoryWindow.createParent')"
            class="sm:w-48"
          />
          <UInput
            v-model="newName"
            maxlength="60"
            :placeholder="t('categoryWindow.createName')"
            class="flex-1"
            data-testid="category-create-name"
          />
          <UButton type="submit" :label="t('common.save')" :disabled="!newParent || !newName" />
        </form>

        <URadioGroup
          v-model="tab"
          orientation="horizontal"
          :items="[
            { value: 'all', label: t('categoryWindow.all') },
            { value: 'own', label: t('categoryWindow.own') },
          ]"
        />

        <div
          class="max-h-80 space-y-1 overflow-y-auto rounded-md border border-default p-1"
          data-testid="category-groups"
        >
          <p v-if="groups.length === 0" class="p-3 text-sm text-muted">
            {{ t('categoryWindow.none') }}
          </p>
          <div v-for="group in groups" :key="group.main.id" class="rounded-md">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-elevated"
              :aria-expanded="isOpenGroup(group.main.id)"
              :data-testid="`category-group-${group.main.id}`"
              @click="
                group.main.children.length > 0 ? toggleGroup(group.main.id) : choose(group.main)
              "
            >
              <CategoryIcon
                :icon="iconOf(group.main.id)"
                :color="colorOf(group.main.id)"
                size="sm"
              />
              <span class="flex-1">{{ group.main.name }}</span>
              <UIcon
                v-if="group.main.children.length > 0"
                :name="isOpenGroup(group.main.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="size-4 text-muted"
              />
              <UIcon
                v-else-if="selected === group.main.id"
                name="i-lucide-check"
                class="size-4 text-primary"
              />
            </button>
            <ul v-if="isOpenGroup(group.main.id)" class="ml-8 space-y-0.5 pb-1">
              <li v-for="child in group.children" :key="child.id">
                <button
                  type="button"
                  role="option"
                  :aria-selected="selected === child.id"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-elevated"
                  :class="{ 'bg-elevated font-medium': selected === child.id }"
                  :data-testid="`category-option-${child.id}`"
                  @click="choose(child)"
                >
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :style="{ background: colorOf(child.id) }"
                  />
                  <span class="flex-1">{{ child.name }}</span>
                  <UIcon
                    v-if="selected === child.id"
                    name="i-lucide-check"
                    class="size-4 text-primary"
                  />
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="selected" class="space-y-3 border-t border-default pt-3">
          <p class="text-sm" data-testid="category-selected">
            <span class="text-muted">{{ t('rules.category') }}:</span> {{ selectedName }}
          </p>
          <URadioGroup
            v-if="scopeItems.length > 0"
            v-model="scope"
            :items="scopeItems"
            data-testid="category-scope"
          />
          <UCheckbox
            v-model="remember"
            :disabled="!canRemember"
            :label="t('rules.remember')"
            :description="!canRemember && !single ? t('rules.mixedRecipients') : undefined"
            data-testid="category-remember"
          />
          <RuleFields v-if="remember && canRemember" v-model="draft" />
        </div>
      </div>
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
          :disabled="!selected"
          :label="t('common.save')"
          data-testid="category-change-save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
