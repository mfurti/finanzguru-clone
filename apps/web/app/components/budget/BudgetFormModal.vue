<script setup lang="ts">
import type { FetchError } from 'ofetch'

/** Create or edit a monthly budget (003 US4): category and limit in a dialog. */
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{
  edit?: { id: string; categoryId: string; limitCents: number } | null
}>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const { items: categoryItems } = await useCategoryOptions(['expense', 'savings'])

const form = reactive({ categoryId: '', limit: 0 })
const error = ref<string | null>(null)
watch(open, (isOpen) => {
  if (!isOpen) return
  error.value = null
  Object.assign(form, {
    categoryId: props.edit?.categoryId ?? '',
    limit: props.edit ? props.edit.limitCents / 100 : 0,
  })
})

async function save(): Promise<void> {
  error.value = null
  const body = { categoryId: form.categoryId, monthlyLimitCents: Math.round(form.limit * 100) }
  try {
    await apiFetch(props.edit ? `/api/budgets/${props.edit.id}` : '/api/budgets', {
      method: props.edit ? 'PATCH' : 'POST',
      body,
    })
    open.value = false
    emit('saved')
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? t('forms.failed')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="edit ? t('budgetsPage.edit') : t('budget.budgets.create')"
    data-testid="budget-modal"
  >
    <template #body>
      <form id="budget-form" class="grid gap-3" @submit.prevent="save">
        <UFormField :label="t('budget.budgets.category')">
          <USelectMenu
            v-model="form.categoryId"
            :items="categoryItems"
            value-key="value"
            class="w-full"
            data-testid="budget-category"
          />
        </UFormField>
        <UFormField :label="t('budget.budgets.limit')">
          <UInputNumber
            v-model="form.limit"
            :min="0"
            :step="10"
            :format-options="{ style: 'currency', currency: 'EUR' }"
            locale="de-DE"
            class="w-full"
            data-testid="budget-limit"
          />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
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
          type="submit"
          form="budget-form"
          :disabled="!form.categoryId || form.limit <= 0"
          :label="t('common.save')"
          data-testid="budget-save"
        />
      </div>
    </template>
  </UModal>
</template>
