<script setup lang="ts">
import type { CategorizationRuleDto, RuleDraft } from '@finance/shared'
import type { FetchError } from 'ofetch'

const { t } = useI18n()
useHead({ title: t('settings.categories') })
const toast = useToast()

const { tree, items: categoryItems, refresh: refreshTree } = await useCategoryOptions()
const { data: rules, refresh: refreshRules } = await useApi<CategorizationRuleDto[]>('/api/rules', {
  default: () => [],
})
const categoryName = (id: string) =>
  categoryItems.value.find((item) => item.value === id)?.label ?? id

const newSub = reactive<Record<string, string>>({})
async function addSub(parentId: string, kind: string): Promise<void> {
  const name = newSub[parentId]?.trim()
  if (!name) return
  try {
    await apiFetch('/api/categories', { method: 'POST', body: { parentId, name, kind } })
    newSub[parentId] = ''
    await refreshTree()
  } catch (cause) {
    toast.add({
      title: (cause as FetchError).data?.statusMessage ?? t('forms.failed'),
      color: 'error',
    })
  }
}

async function removeCategory(id: string): Promise<void> {
  try {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' })
    await refreshTree()
  } catch (cause) {
    toast.add({
      title: (cause as FetchError).data?.statusMessage ?? t('forms.failed'),
      color: 'error',
    })
  }
}

/** Icon/color change (003 US3); every view reads the same category tree. */
async function setAppearance(id: string, patch: { icon?: string; color?: string }): Promise<void> {
  await apiFetch(`/api/categories/${id}`, { method: 'PATCH', body: patch })
  await refreshTree()
}

/** Rule editor (006 US3): new or existing rule, with the shared fields and live preview. */
const editor = reactive<{
  open: boolean
  id: string | null
  draft: RuleDraft
  categoryId: string | undefined
  busy: boolean
}>({
  open: false,
  id: null,
  draft: { matchField: 'counterparty', operator: 'contains', pattern: '' },
  categoryId: undefined,
  busy: false,
})
function openEditor(rule?: CategorizationRuleDto): void {
  editor.id = rule?.id ?? null
  editor.draft = rule
    ? {
        matchField: rule.matchField,
        operator: rule.operator,
        pattern: rule.pattern,
        amountSign: rule.amountSign ?? null,
      }
    : { matchField: 'counterparty', operator: 'contains', pattern: '' }
  editor.categoryId = rule?.categoryId
  editor.open = true
}
async function saveRule(): Promise<void> {
  if (!editor.categoryId || !editor.draft.pattern.trim()) return
  editor.busy = true
  try {
    const body = { ...editor.draft, categoryId: editor.categoryId }
    if (editor.id) {
      await apiFetch(`/api/rules/${editor.id}`, { method: 'PATCH', body })
    } else {
      await apiFetch('/api/rules', { method: 'POST', body })
    }
    editor.open = false
    toast.add({ title: t('rules.saved'), color: 'success' })
    await refreshRules()
  } catch (cause) {
    toast.add({
      title: (cause as FetchError).data?.message ?? t('forms.failed'),
      color: 'error',
    })
  } finally {
    editor.busy = false
  }
}
/** Moves a rule one place up or down; the order decides which rule wins. */
async function move(index: number, step: -1 | 1): Promise<void> {
  const ids = rules.value!.map((rule) => rule.id)
  const target = index + step
  if (target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  rules.value = await apiFetch<CategorizationRuleDto[]>('/api/rules/reorder', {
    method: 'POST',
    body: { ids },
  })
}
async function setEnabled(rule: CategorizationRuleDto, enabled: boolean): Promise<void> {
  await apiFetch(`/api/rules/${rule.id}`, { method: 'PATCH', body: { enabled } })
  await refreshRules()
}

async function removeRule(id: string): Promise<void> {
  await apiFetch(`/api/rules/${id}`, { method: 'DELETE' })
  await refreshRules()
}

async function applyRules(): Promise<void> {
  const result = await apiFetch<{ updated: number }>('/api/rules/apply', { method: 'POST' })
  toast.add({ title: t('rules.appliedAll', { n: result.updated }), color: 'success' })
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.categories') }}</h1>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('categories.title') }}</h2>
      </template>
      <ul class="divide-y divide-default text-sm" data-testid="category-tree">
        <li v-for="main in tree" :key="main.id" class="py-2">
          <div class="flex items-center gap-2 font-medium">
            <CategoryAppearancePicker :node="main" @change="(p) => setAppearance(main.id, p)" />
            {{ main.name }}
          </div>
          <ul class="ml-4 mt-1 space-y-1">
            <li
              v-for="child in main.children"
              :key="child.id"
              class="flex items-center justify-between"
            >
              <span class="flex items-center gap-2">
                <CategoryAppearancePicker
                  :node="child"
                  :parent-color="main.color"
                  @change="(p) => setAppearance(child.id, p)"
                />
                {{ child.name }}
              </span>
              <UButton
                v-if="!child.isDefault"
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="t('common.delete')"
                @click="removeCategory(child.id)"
              />
            </li>
            <li>
              <form class="flex gap-2" @submit.prevent="addSub(main.id, main.kind)">
                <UInput
                  v-model="newSub[main.id]"
                  size="xs"
                  :placeholder="t('categories.newSub')"
                  class="flex-1"
                />
                <UButton
                  type="submit"
                  size="xs"
                  icon="i-lucide-plus"
                  :aria-label="t('categories.add')"
                />
              </form>
            </li>
          </ul>
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t('categories.rules') }}</h2>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              icon="i-lucide-plus"
              :label="t('rules.new')"
              data-testid="rule-new"
              @click="openEditor()"
            />
            <UButton
              size="sm"
              variant="soft"
              icon="i-lucide-wand-sparkles"
              :label="t('categories.apply')"
              @click="applyRules"
            />
          </div>
        </div>
      </template>
      <EmptyState
        v-if="rules!.length === 0"
        :title="t('categories.noRules')"
        icon="i-lucide-list-filter"
      />
      <ol v-else class="divide-y divide-default text-sm" data-testid="rule-list">
        <li
          v-for="(rule, index) in rules"
          :key="rule.id"
          class="row-hover flex flex-wrap items-center justify-between gap-2 py-2"
          :class="{ 'opacity-60': !rule.enabled }"
          data-testid="rule-row"
        >
          <span class="min-w-0 flex-1">
            <span class="text-muted">{{ index + 1 }}.</span>
            {{ t(`rules.fields.${rule.matchField}`) }}
            {{ t(`rules.operators.${rule.operator}`) }} „{{ rule.pattern }}“
            <span v-if="rule.amountSign" class="text-muted">
              ({{ t(`rules.signs.${rule.amountSign}`) }})
            </span>
            →
            <strong>{{ categoryName(rule.categoryId) }}</strong>
          </span>
          <span class="flex items-center gap-1">
            <USwitch
              :model-value="rule.enabled"
              :aria-label="t('rules.active')"
              size="sm"
              data-testid="rule-enabled"
              @update:model-value="(value: boolean) => setEnabled(rule, value)"
            />
            <UButton
              icon="i-lucide-arrow-up"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="index === 0"
              :aria-label="t('rules.up')"
              data-testid="rule-up"
              @click="move(index, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="index === rules!.length - 1"
              :aria-label="t('rules.down')"
              data-testid="rule-down"
              @click="move(index, 1)"
            />
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              color="neutral"
              :aria-label="t('rules.edit')"
              data-testid="rule-edit"
              @click="openEditor(rule)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="neutral"
              :aria-label="t('common.delete')"
              data-testid="rule-delete"
              @click="removeRule(rule.id)"
            />
          </span>
        </li>
      </ol>
    </UCard>

    <UModal v-model:open="editor.open" :title="editor.id ? t('rules.edit') : t('rules.new')">
      <template #body>
        <form class="space-y-3" @submit.prevent="saveRule">
          <UFormField :label="t('rules.category')">
            <USelectMenu
              v-model="editor.categoryId"
              :items="categoryItems"
              value-key="value"
              class="w-full"
              data-testid="rule-category"
            />
          </UFormField>
          <RuleFields v-model="editor.draft" />
          <button type="submit" class="hidden" aria-hidden="true" tabindex="-1" />
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="editor.open = false"
          />
          <UButton
            :loading="editor.busy"
            :disabled="!editor.categoryId || !editor.draft.pattern.trim()"
            :label="t('common.save')"
            data-testid="rule-save"
            @click="saveRule"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>
