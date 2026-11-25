<script setup lang="ts">
import type { RuleDraft, RulePreviewResult } from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * Editable rule (field, condition, text, amount sign) with a live count of the bookings it
 * would change (006 US1/US3, research R6). Used in the category dialog and on the rules page.
 */
const draft = defineModel<RuleDraft>({ required: true })
const { t } = useI18n()

const fieldItems = computed(() =>
  (['counterparty', 'counterparty_iban', 'purpose'] as const).map((value) => ({
    value,
    label: t(`rules.fields.${value}`),
  })),
)
const operatorItems = computed(() =>
  (['contains', 'equals', 'starts_with', 'regex'] as const).map((value) => ({
    value,
    label: t(`rules.operators.${value}`),
  })),
)
const signItems = computed(() =>
  (['any', 'positive', 'negative'] as const).map((value) => ({
    value,
    label: t(`rules.signs.${value}`),
  })),
)
const sign = computed({
  get: () => draft.value.amountSign ?? 'any',
  set: (value: string) => {
    draft.value = {
      ...draft.value,
      amountSign: value === 'any' ? null : (value as 'positive' | 'negative'),
    }
  },
})
const update = (patch: Partial<RuleDraft>) => {
  draft.value = { ...draft.value, ...patch }
}

const preview = ref<RulePreviewResult | null>(null)
const invalid = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let sequence = 0
/** Debounced preview (300 ms); answers of older drafts are dropped. */
watch(
  draft,
  (value) => {
    clearTimeout(timer)
    if (!value.pattern.trim()) {
      preview.value = null
      invalid.value = false
      return
    }
    timer = setTimeout(async () => {
      const current = ++sequence
      try {
        const result = await apiFetch<RulePreviewResult>('/api/rules/preview', {
          method: 'POST',
          body: value,
        })
        if (current !== sequence) return
        preview.value = result
        invalid.value = false
      } catch (error) {
        if (current !== sequence) return
        preview.value = null
        invalid.value = error instanceof FetchError && error.statusCode === 400
      }
    }, 300)
  },
  { deep: true, immediate: true },
)
</script>

<template>
  <div class="space-y-2" data-testid="rule-fields">
    <div class="grid gap-2 sm:grid-cols-2">
      <UFormField :label="t('rules.field')">
        <USelect
          :model-value="draft.matchField"
          :items="fieldItems"
          class="w-full"
          data-testid="rule-field"
          @update:model-value="update({ matchField: $event as RuleDraft['matchField'] })"
        />
      </UFormField>
      <UFormField :label="t('rules.operator')">
        <USelect
          :model-value="draft.operator"
          :items="operatorItems"
          class="w-full"
          data-testid="rule-operator"
          @update:model-value="update({ operator: $event as RuleDraft['operator'] })"
        />
      </UFormField>
    </div>
    <UFormField :label="t('rules.pattern')" :error="invalid ? t('rules.invalidRegex') : undefined">
      <UInput
        :model-value="draft.pattern"
        maxlength="200"
        class="w-full"
        data-testid="rule-pattern"
        @update:model-value="update({ pattern: String($event) })"
      />
    </UFormField>
    <UFormField :label="t('rules.sign')">
      <USelect v-model="sign" :items="signItems" class="w-full" data-testid="rule-sign" />
    </UFormField>
    <p v-if="preview" class="text-xs text-muted" data-testid="rule-preview">
      {{ t('rules.preview', { n: preview.wouldChange }) }}
      <span v-if="preview.matches !== preview.wouldChange">
        · {{ t('rules.previewMatches', { n: preview.matches }) }}
      </span>
    </p>
  </div>
</template>
