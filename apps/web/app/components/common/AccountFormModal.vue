<script setup lang="ts">
import { ACCOUNT_TYPES, type AccountDto, type AccountType } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** "Konto anlegen" (FR-056). */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [account: AccountDto] }>()
const { t } = useI18n()

const form = reactive({ name: '', type: 'checking' as AccountType, iban: '', balance: 0 })
const error = ref<string | null>(null)
const busy = ref(false)
const typeItems = computed(() =>
  ACCOUNT_TYPES.map((value) => ({ value, label: t(`accountTypes.${value}`) })),
)

watch(open, (isOpen) => {
  if (isOpen) Object.assign(form, { name: '', type: 'checking', iban: '', balance: 0 })
  error.value = null
})

async function submit(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    const created = await apiFetch<AccountDto>('/api/accounts', {
      method: 'POST',
      body: {
        name: form.name,
        type: form.type,
        iban: form.iban || undefined,
        balanceCents: Math.round(form.balance * 100),
      },
    })
    emit('created', created)
    open.value = false
    await refreshNuxtData()
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? t('forms.failed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('add.account')">
    <template #body>
      <form id="account-form" class="space-y-3" @submit.prevent="submit">
        <UFormField :label="t('forms.name')" required>
          <UInput
            v-model="form.name"
            required
            maxlength="80"
            class="w-full"
            data-testid="account-name"
          />
        </UFormField>
        <UFormField :label="t('forms.type')">
          <USelect v-model="form.type" :items="typeItems" class="w-full" />
        </UFormField>
        <UFormField :label="t('forms.iban')" :hint="t('forms.optional')">
          <UInput v-model="form.iban" class="w-full" />
        </UFormField>
        <UFormField v-if="form.type !== 'depot'" :label="t('forms.balance')">
          <UInputNumber
            v-model="form.balance"
            :step="0.01"
            :format-options="{ style: 'currency', currency: 'EUR' }"
            locale="de-DE"
            class="w-full"
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
          form="account-form"
          :loading="busy"
          :label="t('common.save')"
          data-testid="account-save"
        />
      </div>
    </template>
  </UModal>
</template>
