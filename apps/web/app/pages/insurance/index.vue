<script setup lang="ts">
import type { InsuranceDto } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('nav.insurance') })

const { data: contracts, refresh } = await useApi<InsuranceDto[]>('/api/insurance', {
  default: () => [],
})
const formOpen = ref(false)
const editing = ref<InsuranceDto | null>(null)
const deleting = ref<InsuranceDto | null>(null)

const yearlyTotal = computed(() =>
  (contracts.value ?? []).reduce((sum, c) => sum + c.yearlyCostCents, 0),
)

function add(): void {
  editing.value = null
  formOpen.value = true
}
function edit(contract: InsuranceDto): void {
  editing.value = contract
  formOpen.value = true
}
async function confirmDelete(): Promise<void> {
  if (!deleting.value) return
  await apiFetch(`/api/insurance/${deleting.value.id}`, { method: 'DELETE' })
  deleting.value = null
  await refresh()
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">{{ t('nav.insurance') }}</h1>
      <UButton
        icon="i-lucide-plus"
        :label="t('insurance.add')"
        data-testid="insurance-add"
        @click="add"
      />
    </div>
    <UCard>
      <EmptyState
        v-if="contracts!.length === 0"
        :title="t('insurance.emptyTitle')"
        :description="t('insurance.emptyDescription')"
        icon="i-lucide-shield"
        :action-label="t('insurance.add')"
        @action="add"
      />
      <template v-else>
        <ContractList
          :contracts="contracts!"
          @edit="edit"
          @remove="(contract) => (deleting = contract)"
        />
        <div class="mt-3 flex justify-end gap-2 border-t border-default pt-3 text-sm">
          <span class="text-muted">{{ t('insurance.total') }}</span>
          <Money :cents="yearlyTotal" class="font-semibold" />
        </div>
      </template>
    </UCard>

    <ContractForm v-model:open="formOpen" :contract="editing" @saved="refresh()" />

    <UModal
      :open="!!deleting"
      :title="t('insurance.deleteTitle')"
      @update:open="(value) => !value && (deleting = null)"
    >
      <template #body>
        <p class="text-sm">{{ t('insurance.deleteText', { name: deleting?.provider ?? '' }) }}</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="deleting = null"
          />
          <UButton
            color="error"
            :label="t('common.delete')"
            data-testid="contract-delete-confirm"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>
