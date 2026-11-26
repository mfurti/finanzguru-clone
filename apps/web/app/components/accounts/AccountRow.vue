<script setup lang="ts">
import { formatDate, type AccountOverviewRow } from '@finance/shared'

/**
 * One account or depot in Portfolios & Konten (003 US2, FR-008): avatar,
 * name and institution, masked IBAN with copy, 30-day sparkline, last
 * sync/import with "Aktualisieren" where the source can sync, balance.
 */
const props = defineProps<{ row: AccountOverviewRow }>()
const { t } = useI18n()
const toast = useToast()
const to = computed(() => `/${props.row.type === 'depot' ? 'depots' : 'accounts'}/${props.row.id}`)
const syncing = ref(false)

async function sync(): Promise<void> {
  syncing.value = true
  try {
    await apiFetch(`/api/accounts/${props.row.id}/sync`, { method: 'POST' })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    syncing.value = false
  }
}
/** Bank and broker logo (009). */
const { byAccount } = await useAccountLogos()
</script>

<template>
  <li class="row-hover relative" data-testid="account-row">
    <NuxtLink
      :to="to"
      class="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_96px_auto] sm:px-6"
      :data-testid="`account-link-${row.id}`"
    >
      <MerchantLogo
        :name="row.institution === 'Manuell' ? row.name : row.institution"
        :logo="byAccount(row.id)"
      />
      <span class="min-w-0">
        <span class="block truncate font-medium">{{ row.name }}</span>
        <span class="block truncate text-xs text-muted">{{ row.institution }}</span>
      </span>
      <span class="hidden min-w-0 text-xs text-muted sm:block">
        <span v-if="row.ibanMasked" class="flex items-center gap-1">
          <span class="truncate font-mono" data-testid="iban-masked">{{ row.ibanMasked }}</span>
          <CopyButton :value="row.iban!" :label="t('accountsOverview.copyIban')" />
        </span>
        <span class="block">
          <template v-if="row.lastUpdateKind === 'import'">
            {{
              t('accountsOverview.lastImport', { date: formatDate(row.lastUpdateAt!.slice(0, 10)) })
            }}
          </template>
          <template v-else-if="row.lastUpdateKind === 'sync'">
            {{
              t('accountsOverview.lastSync', { date: formatDate(row.lastUpdateAt!.slice(0, 10)) })
            }}
          </template>
          <template v-else>{{ t('accountsOverview.noUpdate') }}</template>
        </span>
      </span>
      <Sparkline :values="row.sparkline" class="hidden sm:block" />
      <Money :cents="row.balanceCents" class="text-right font-semibold" />
    </NuxtLink>
    <UButton
      v-if="row.canSync"
      icon="i-lucide-refresh-cw"
      size="xs"
      variant="ghost"
      color="neutral"
      :loading="syncing"
      :aria-label="t('accountsOverview.refresh')"
      class="absolute top-1 right-1"
      @click="sync"
    />
  </li>
</template>
