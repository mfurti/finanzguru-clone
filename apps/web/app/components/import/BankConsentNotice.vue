<script setup lang="ts">
import type { DataSourceDto } from '@finance/shared'

/**
 * App-wide notice when the bank consent ends within 14 days or has ended (005 FR-006).
 * Loaded on the client only, so pages render without waiting for it.
 */
const { t } = useI18n()
const route = useRoute()
const { data } = useApi<DataSourceDto[]>('/api/sources', {
  key: 'bank-consent-notice',
  server: false,
  lazy: true,
  default: () => [],
})
const bank = computed(() => data.value?.find((source) => source.kind === 'enable_banking'))
const expired = computed(() => bank.value?.status === 'consent_expired')
const daysLeft = computed(() => {
  const end = bank.value?.consentEndsAt
  return end ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000)) : 0
})
const visible = computed(
  () =>
    route.path !== '/settings/sources' &&
    (expired.value || (bank.value?.status === 'active' && !!bank.value.consentWarning)),
)
</script>

<template>
  <UAlert
    v-if="visible"
    class="mb-4"
    color="warning"
    variant="subtle"
    :icon="expired ? 'i-lucide-clock-alert' : 'i-lucide-clock'"
    :title="expired ? t('bank.expired') : t('bank.endsIn', { days: daysLeft })"
    :actions="[{ label: t('bank.renew'), to: '/settings/sources', variant: 'soft' }]"
    data-testid="bank-consent-notice"
  />
</template>
