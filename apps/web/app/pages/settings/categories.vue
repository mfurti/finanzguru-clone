<script setup lang="ts">
import type { CategorizationRuleDto } from '@finance/shared'
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

async function removeRule(id: string): Promise<void> {
  await apiFetch(`/api/rules/${id}`, { method: 'DELETE' })
  await refreshRules()
}

async function applyRules(): Promise<void> {
  const result = await apiFetch<{ updated: number }>('/api/rules/apply', { method: 'POST' })
  toast.add({ title: t('budget.review.applied', { n: result.updated }), color: 'success' })
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
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-wand-sparkles"
            :label="t('categories.apply')"
            @click="applyRules"
          />
        </div>
      </template>
      <EmptyState
        v-if="rules!.length === 0"
        :title="t('categories.noRules')"
        icon="i-lucide-list-filter"
      />
      <ol v-else class="divide-y divide-default text-sm" data-testid="rule-list">
        <li
          v-for="rule in rules"
          :key="rule.id"
          class="row-hover flex items-center justify-between gap-2 py-2"
        >
          <span>
            <span class="text-muted">{{ rule.priority }}.</span>
            {{ t(`categories.fields.${rule.matchField}`) }}
            {{ t(`categories.operators.${rule.operator}`) }} „{{ rule.pattern }}“ →
            <strong>{{ categoryName(rule.categoryId) }}</strong>
          </span>
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="t('common.delete')"
            @click="removeRule(rule.id)"
          />
        </li>
      </ol>
    </UCard>
  </section>
</template>
