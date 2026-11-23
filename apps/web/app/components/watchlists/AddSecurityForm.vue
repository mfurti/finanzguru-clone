<script setup lang="ts">
import { isValidIsin } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Adds a security by ISIN and name to a watchlist (US6). */
const props = defineProps<{ watchlistId: string }>()
const emit = defineEmits<{ added: [] }>()
const { t } = useI18n()

const isin = ref('')
const name = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const normalized = computed(() => isin.value.trim().toUpperCase())
const invalid = computed(() => normalized.value.length > 0 && !isValidIsin(normalized.value))

async function add(): Promise<void> {
  if (invalid.value) return
  busy.value = true
  error.value = null
  try {
    await apiFetch(`/api/watchlists/${props.watchlistId}/entries`, {
      method: 'POST',
      body: { isin: normalized.value, name: name.value.trim() },
    })
    isin.value = ''
    name.value = ''
    emit('added')
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="space-y-2" data-testid="watchlist-add" @submit.prevent="add">
    <div class="flex flex-col gap-2 sm:flex-row">
      <UFormField :error="invalid ? t('watchlists.invalidIsin') : undefined" class="sm:w-44">
        <UInput
          v-model="isin"
          :placeholder="t('watchlists.isin')"
          maxlength="12"
          class="w-full"
          data-testid="watchlist-isin"
        />
      </UFormField>
      <UInput
        v-model="name"
        :placeholder="t('watchlists.securityName')"
        maxlength="200"
        class="flex-1"
        data-testid="watchlist-name"
      />
      <UButton
        type="submit"
        icon="i-lucide-plus"
        :label="t('watchlists.add')"
        :loading="busy"
        :disabled="invalid || normalized.length !== 12 || !name.trim()"
        data-testid="watchlist-add-submit"
      />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" />
  </form>
</template>
