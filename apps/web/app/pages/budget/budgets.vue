<script setup lang="ts">
import type { BudgetDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

const { t } = useI18n()
useHead({ title: t('budget.budgets.title') })

const { items: categoryItems } = await useCategoryOptions(['expense', 'savings'])
const { data: budgets, refresh } = await useApi<BudgetDto[]>('/api/budgets', {
  key: 'budgets',
  default: () => [],
})

const form = reactive({ categoryId: '', limit: 0 })
const error = ref<string | null>(null)

async function create(): Promise<void> {
  error.value = null
  try {
    await apiFetch('/api/budgets', {
      method: 'POST',
      body: { categoryId: form.categoryId, monthlyLimitCents: Math.round(form.limit * 100) },
    })
    Object.assign(form, { categoryId: '', limit: 0 })
    await refresh()
    await refreshNuxtData('budgets-overview')
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? t('forms.failed')
  }
}

async function remove(id: string): Promise<void> {
  await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.budget') }}</h1>
    <BudgetNav />
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('budget.budgets.create') }}</h2>
      </template>
      <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="create">
        <UFormField :label="t('budget.budgets.category')" class="flex-1">
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
            data-testid="budget-limit"
          />
        </UFormField>
        <UButton
          type="submit"
          :disabled="!form.categoryId || form.limit <= 0"
          :label="t('common.save')"
          data-testid="budget-save"
        />
      </form>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" class="mt-3" />
    </UCard>

    <UCard data-testid="budget-list">
      <EmptyState
        v-if="budgets!.length === 0"
        :title="t('overview.budgets.emptyTitle')"
        :description="t('overview.budgets.emptyDescription')"
        icon="i-lucide-piggy-bank"
      />
      <BudgetProgressList v-else :budgets="budgets!" removable @remove="remove" />
    </UCard>
  </section>
</template>
