<script setup lang="ts">
import type { DataSourceDto } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('settings.sources') })

const { data: sources, refresh } = await useApi<DataSourceDto[]>('/api/sources', {
  default: () => [],
})

/** Scalable (004 US1) and the bank (005 US1) have their own cards; the list shows the rest. */
const OWN_CARDS = new Set(['scalable_mcp', 'enable_banking'])
const scalable = computed(() => sources.value?.find((s) => s.kind === 'scalable_mcp') ?? null)
const bank = computed(() => sources.value?.find((s) => s.kind === 'enable_banking') ?? null)
const others = computed(() => (sources.value ?? []).filter((s) => !OWN_CARDS.has(s.kind)))
const route = useRoute()
const toast = useToast()
onMounted(() => {
  if (route.query.connected === 'bank') {
    toast.add({ title: t('bank.connected'), color: 'success' })
  } else if (route.query.error === 'bank') {
    const reason = String(route.query.reason ?? '')
    toast.add({
      title: t('bank.errors.generic'),
      description: ['denied', 'state', 'expired'].includes(reason)
        ? t(`bank.errors.${reason}`)
        : undefined,
      color: 'error',
      duration: 0,
    })
  } else if (route.query.connected === 'scalable') {
    toast.add({ title: t('scalable.connected'), color: 'success' })
  } else if (route.query.error === 'scalable') {
    const reason = route.query.reason
    toast.add({
      title: t('scalable.refused'),
      description:
        reason === 'agentic'
          ? t('scalable.refusedAgentic')
          : reason === 'denied'
            ? t('scalable.refusedDenied')
            : t('common.error'),
      color: 'error',
      duration: 0,
    })
  }
})

const statusColor = (status: DataSourceDto['status']) =>
  status === 'active'
    ? 'success'
    : status === 'planned' || status === 'disabled'
      ? 'neutral'
      : status === 'needs_reauth' || status === 'consent_expired'
        ? 'warning'
        : 'error'
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">{{ t('settings.sources') }}</h1>
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/settings/inflation"
          variant="soft"
          color="neutral"
          icon="i-lucide-percent"
          :label="t('settings.inflation')"
        />
        <UButton
          to="/settings/categories"
          variant="soft"
          color="neutral"
          icon="i-lucide-tags"
          :label="t('settings.categories')"
        />
      </div>
    </div>

    <UCard id="csv" class="scroll-mt-20">
      <template #header>
        <h2 class="font-semibold">{{ t('import.title') }}</h2>
        <p class="text-sm text-muted">{{ t('import.subtitle') }}</p>
      </template>
      <CsvUpload @imported="refresh()" />
    </UCard>

    <BankCard id="bank" class="scroll-mt-20" :source="bank" @changed="refresh()" />

    <ScalableCard id="scalable" class="scroll-mt-20" :source="scalable" @changed="refresh()" />

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('sources.title') }}</h2>
      </template>
      <ul class="divide-y divide-default" data-testid="sources-list">
        <li
          v-for="source in others"
          :key="source.id"
          class="row-hover flex items-center justify-between gap-3 py-2 text-sm"
        >
          <span>
            <span class="block font-medium">{{ source.displayName }}</span>
            <span v-if="source.lastSyncAt" class="text-xs text-muted">
              {{
                t('sources.lastSync', { at: new Date(source.lastSyncAt).toLocaleString('de-DE') })
              }}
            </span>
          </span>
          <UBadge
            :color="statusColor(source.status)"
            variant="subtle"
            :data-testid="`source-status-${source.kind}`"
            :title="source.status === 'planned' ? t('sources.plannedHint') : undefined"
          >
            {{ t(`sources.status.${source.status}`) }}
          </UBadge>
        </li>
      </ul>
    </UCard>

    <!-- Licence of the built-in brand logos (008 FR-011). -->
    <p class="px-1 text-xs text-muted" data-testid="logo-licence">{{ t('logo.licence') }}</p>
  </section>
</template>
