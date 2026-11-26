<script setup lang="ts">
import type { RuleSuggestionDto } from '@finance/shared'

/**
 * "Regel anlegen?" (006 US2): recipients the owner put into the same category by hand at least
 * twice. Accepting saves and applies the rule; "Nicht mehr vorschlagen" hides the pair for good.
 * Reloads when a category change produced a new suggestion (shared state).
 */
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const { items: categoryItems } = await useCategoryOptions()
const refreshKey = useState('rule-suggestions-refresh', () => 0)

const { data, refresh } = useApi<RuleSuggestionDto[]>('/api/rules/suggestions', {
  key: 'rule-suggestions',
  server: false,
  default: () => [],
})
watch(refreshKey, () => void refresh())

const categoryName = (id: string) =>
  categoryItems.value.find((item) => item.value === id)?.label ?? ''
const busy = ref<string | null>(null)

async function accept(item: RuleSuggestionDto): Promise<void> {
  busy.value = item.id
  try {
    const result = await apiFetch<{ ruleId: string; applied: number }>(
      `/api/rules/suggestions/${item.id}/accept`,
      { method: 'POST' },
    )
    toast.add({ title: t('rules.applied', { n: result.applied }), color: 'success' })
    emit('changed')
  } finally {
    busy.value = null
    await refresh()
  }
}

async function decline(item: RuleSuggestionDto): Promise<void> {
  busy.value = item.id
  try {
    await apiFetch(`/api/rules/suggestions/${item.id}/decline`, { method: 'POST' })
  } finally {
    busy.value = null
    await refresh()
  }
}
</script>

<template>
  <UAlert
    v-if="data && data.length > 0"
    color="info"
    variant="subtle"
    icon="i-lucide-lightbulb"
    :title="t('rules.suggest')"
    data-testid="rule-suggestions"
  >
    <template #description>
      <ul class="mt-1 space-y-2">
        <li
          v-for="item in data"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-2"
          data-testid="rule-suggestion"
        >
          <span class="min-w-0 text-sm">
            {{
              t('rules.suggestText', {
                counterparty: item.counterparty,
                category: categoryName(item.categoryId),
                n: item.affected,
              })
            }}
          </span>
          <span class="flex gap-1">
            <UButton
              size="xs"
              :loading="busy === item.id"
              :label="t('rules.accept')"
              data-testid="rule-suggestion-accept"
              @click="accept(item)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="busy === item.id"
              :label="t('rules.decline')"
              data-testid="rule-suggestion-decline"
              @click="decline(item)"
            />
          </span>
        </li>
      </ul>
    </template>
  </UAlert>
</template>
