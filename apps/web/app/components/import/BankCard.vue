<script setup lang="ts">
import type {
  BankConnectResponse,
  BankInstitution,
  DataSourceDto,
  SyncStarted,
} from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * Bank connection through Enable Banking (005 US1, FR-001…FR-007): the owner picks the bank,
 * logs in and approves read access on the bank's own page. Shows status, consent end with a
 * warning from 14 days before, approved accounts, manual sync and disconnect.
 */
const props = defineProps<{ source: DataSourceDto | null }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref<'connect' | 'sync' | 'disconnect' | 'banks' | null>(null)

const status = computed(() => props.source?.status ?? 'disabled')
const connected = computed(() => status.value === 'active')
const badge = computed(() => {
  switch (status.value) {
    case 'active':
      return { color: 'success' as const, label: t('scalable.connected') }
    case 'consent_expired':
    case 'needs_reauth':
      return { color: 'warning' as const, label: t('bank.expired') }
    case 'error':
      return { color: 'error' as const, label: t('scalable.error') }
    default:
      return { color: 'neutral' as const, label: t('scalable.disabled') }
  }
})
const endsAt = computed(() =>
  props.source?.consentEndsAt ? new Date(props.source.consentEndsAt) : null,
)
const daysLeft = computed(() =>
  endsAt.value ? Math.max(0, Math.ceil((endsAt.value.getTime() - Date.now()) / 86_400_000)) : null,
)
const lastSync = computed(() =>
  props.source?.lastSyncAt
    ? t('scalable.lastSync', { date: new Date(props.source.lastSyncAt).toLocaleString('de-DE') })
    : t('scalable.never'),
)

/** Bank picker: the list comes from Enable Banking; 503 means the app is not configured. */
const pickerOpen = ref(false)
const banks = ref<BankInstitution[]>([])
const bank = ref<BankInstitution | undefined>()
const notConfigured = ref(false)
const bankItems = computed(() => banks.value.map((item) => ({ label: item.name, value: item })))

async function openPicker(): Promise<void> {
  pickerOpen.value = true
  if (banks.value.length > 0) return
  busy.value = 'banks'
  notConfigured.value = false
  try {
    banks.value = await apiFetch<BankInstitution[]>('/api/sources/bank/institutions?country=DE')
    // Renewal: preselect the bank of the current consent.
    bank.value = banks.value.find((item) => item.name === props.source?.institution)
  } catch (error) {
    if (error instanceof FetchError && error.statusCode === 503) notConfigured.value = true
    else toast.add({ title: t('bank.errors.generic'), color: 'error' })
  } finally {
    busy.value = null
  }
}

async function connect(): Promise<void> {
  if (!bank.value) return
  busy.value = 'connect'
  try {
    const result = await apiFetch<BankConnectResponse>('/api/sources/bank/connect', {
      method: 'POST',
      body: { aspspName: bank.value.name, aspspCountry: bank.value.country },
    })
    // The owner logs in on the bank's page; the bank redirects back to the callback.
    window.location.assign(result.authorizationUrl)
  } catch {
    toast.add({ title: t('bank.errors.generic'), color: 'error' })
    busy.value = null
  }
}

async function sync(): Promise<void> {
  busy.value = 'sync'
  try {
    await apiFetch<SyncStarted>(`/api/sources/${props.source!.id}/sync`, { method: 'POST' })
    toast.add({ title: t('scalable.started'), icon: 'i-lucide-refresh-cw' })
    emit('changed')
  } catch (error) {
    const running = error instanceof FetchError && error.statusCode === 409
    toast.add({
      title: running ? t('scalable.running') : t('common.error'),
      color: running ? 'warning' : 'error',
    })
  } finally {
    busy.value = null
  }
}

const confirmOpen = ref(false)
async function disconnect(): Promise<void> {
  busy.value = 'disconnect'
  try {
    await apiFetch(`/api/sources/${props.source!.id}`, { method: 'DELETE' })
    confirmOpen.value = false
    toast.add({ title: t('bank.disconnected'), color: 'success' })
    emit('changed')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <UCard data-testid="bank-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-semibold">
          <Avatar :name="source?.institution ?? 'Bank'" size="sm" />
          {{ source?.institution ?? t('bank.title') }}
        </h2>
        <UBadge :color="badge.color" variant="subtle" data-testid="bank-status">
          {{ badge.label }}
        </UBadge>
      </div>
    </template>

    <p class="mb-3 text-sm text-muted">{{ t('bank.hint') }}</p>

    <UAlert
      v-if="status === 'consent_expired'"
      class="mb-3"
      color="warning"
      variant="subtle"
      icon="i-lucide-clock-alert"
      :title="t('bank.expired')"
      :description="t('bank.expiredHint')"
      data-testid="bank-expired"
    />
    <UAlert
      v-else-if="connected && source?.consentWarning && daysLeft !== null"
      class="mb-3"
      color="warning"
      variant="subtle"
      icon="i-lucide-clock"
      :title="t('bank.endsIn', { days: daysLeft })"
      data-testid="bank-warning"
    />

    <div v-if="source && status !== 'disabled'" class="mb-3 space-y-1 text-sm">
      <p v-if="endsAt" data-testid="bank-valid-until">
        {{ t('bank.validUntil', { date: endsAt.toLocaleDateString('de-DE') }) }}
      </p>
      <p data-testid="bank-last-sync">{{ lastSync }}</p>
      <p v-if="source.lastRun" class="text-muted">
        {{
          t('scalable.lastRun', {
            imported: source.lastRun.imported,
            skipped: source.lastRun.skipped,
          })
        }}
      </p>
      <p v-if="source.lastError" class="text-error">{{ source.lastError }}</p>
      <p class="text-xs text-muted">
        {{ source.dailySync ? t('scalable.dailyOn') : t('scalable.dailyOff') }}
      </p>
    </div>

    <div v-if="source?.accounts?.length" class="mb-3">
      <h3 class="mb-1 text-xs font-medium text-muted uppercase">{{ t('bank.accounts') }}</h3>
      <ul class="divide-y divide-default text-sm" data-testid="bank-accounts">
        <li
          v-for="item in source.accounts"
          :key="item.id"
          class="flex flex-wrap justify-between gap-2 py-1.5"
        >
          <NuxtLink :to="`/accounts/${item.id}`" class="font-medium hover:underline">
            {{ item.name }}
          </NuxtLink>
          <span class="text-muted tabular-nums">{{ item.maskedIban ?? '–' }}</span>
        </li>
      </ul>
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="!connected"
        icon="i-lucide-landmark"
        :label="status === 'consent_expired' ? t('bank.renew') : t('bank.connect')"
        data-testid="bank-connect"
        @click="openPicker"
      />
      <template v-else>
        <UButton
          icon="i-lucide-refresh-cw"
          :loading="busy === 'sync'"
          :label="t('bank.refresh')"
          data-testid="bank-sync"
          @click="sync"
        />
        <!-- A new consent replaces the old one: renews it and adds accounts approved at the bank. -->
        <UButton
          :icon="source?.consentWarning ? 'i-lucide-key-round' : 'i-lucide-plus'"
          variant="soft"
          :label="source?.consentWarning ? t('bank.renew') : t('bank.addAccounts')"
          data-testid="bank-renew"
          @click="openPicker"
        />
      </template>
      <UButton
        v-if="source && status !== 'disabled' && status !== 'planned'"
        icon="i-lucide-unlink"
        variant="ghost"
        color="neutral"
        :label="t('bank.disconnect')"
        data-testid="bank-disconnect"
        @click="confirmOpen = true"
      />
    </div>

    <UModal v-model:open="pickerOpen" :title="t('bank.choose')">
      <template #body>
        <p v-if="connected && !notConfigured" class="mb-2 text-sm text-muted">
          {{ t('bank.addAccountsHint') }}
        </p>
        <p v-if="notConfigured" class="text-sm text-warning" data-testid="bank-not-configured">
          {{ t('bank.notConfigured') }}
        </p>
        <USelectMenu
          v-else
          v-model="bank"
          :items="bankItems"
          value-key="value"
          :loading="busy === 'banks'"
          :search-input="{ placeholder: t('bank.searchBank') }"
          :placeholder="t('bank.choose')"
          class="w-full"
          data-testid="bank-select"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="pickerOpen = false"
          />
          <UButton
            icon="i-lucide-external-link"
            :disabled="!bank || notConfigured"
            :loading="busy === 'connect'"
            :label="t('bank.connect')"
            data-testid="bank-connect-confirm"
            @click="connect"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="confirmOpen" :title="t('bank.disconnect')">
      <template #body>
        <p class="text-sm">{{ t('bank.disconnectConfirm') }}</p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="confirmOpen = false"
          />
          <UButton
            color="error"
            :loading="busy === 'disconnect'"
            :label="t('bank.disconnect')"
            data-testid="bank-disconnect-confirm"
            @click="disconnect"
          />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
