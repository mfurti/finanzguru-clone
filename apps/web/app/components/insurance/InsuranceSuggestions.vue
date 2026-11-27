<script setup lang="ts">
import type { InsuranceSuggestionDto } from '@finance/shared'

/**
 * Contracts found in recurring Versicherung bookings (012 P14). "Übernehmen" creates the
 * contract (provider, premium, interval, first payment as start) to be completed by hand;
 * "Ausblenden" hides the suggestion for good.
 */
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const { data: suggestions, refresh } = await useApi<InsuranceSuggestionDto[]>(
  '/api/insurance/suggestions',
  { default: () => [] },
)
const busy = ref<string | null>(null)

async function accept(item: InsuranceSuggestionDto): Promise<void> {
  busy.value = item.key
  try {
    await apiFetch('/api/insurance', {
      method: 'POST',
      body: {
        type: item.type,
        provider: item.counterparty.slice(0, 120),
        premiumCents: item.amountCents,
        interval: item.interval,
        startDate: item.firstDate,
      },
    })
    await refresh()
    emit('changed')
  } finally {
    busy.value = null
  }
}
async function dismiss(item: InsuranceSuggestionDto): Promise<void> {
  busy.value = item.key
  try {
    await apiFetch(`/api/insurance/suggestions/${encodeURIComponent(item.key)}/dismiss`, {
      method: 'POST',
    })
    await refresh()
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UCard v-if="(suggestions?.length ?? 0) > 0" data-testid="insurance-suggestions">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
        <div>
          <h2 class="font-semibold">{{ t('insurance.suggestions.title') }}</h2>
          <p class="text-xs text-muted">{{ t('insurance.suggestions.hint') }}</p>
        </div>
      </div>
    </template>
    <ul class="divide-y divide-default text-sm">
      <li
        v-for="item in suggestions"
        :key="item.key"
        class="flex flex-wrap items-center justify-between gap-3 py-2"
        data-testid="insurance-suggestion"
      >
        <span class="min-w-0">
          <span class="block truncate font-medium">{{ item.counterparty }}</span>
          <span class="text-xs text-muted">
            {{ t(`insurance.types.${item.type}`) }} ·
            {{ t('insurance.suggestions.payments', { n: item.count }) }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <span class="whitespace-nowrap tabular-nums">
            <Money :cents="item.amountCents" /> {{ t(`insurance.per.${item.interval}`) }}
          </span>
          <UButton
            size="sm"
            :label="t('insurance.suggestions.accept')"
            :loading="busy === item.key"
            data-testid="insurance-suggestion-accept"
            @click="accept(item)"
          />
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            :label="t('insurance.suggestions.dismiss')"
            :disabled="busy === item.key"
            data-testid="insurance-suggestion-dismiss"
            @click="dismiss(item)"
          />
        </span>
      </li>
    </ul>
  </UCard>
</template>
