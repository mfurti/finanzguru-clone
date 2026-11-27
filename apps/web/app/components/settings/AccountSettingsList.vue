<script setup lang="ts">
import type { AccountDto } from '@finance/shared'

/**
 * Settings › Konten (014 US1): rename, hide, archive and reorder the owner's accounts.
 * Order: drag a row or use the arrows; archived accounts sit in their own list below.
 */
const { t } = useI18n()
const toast = useToast()
const { settings, update } = useSettings()

const { data: accounts, refresh } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})
const active = computed(() => (accounts.value ?? []).filter((acc) => !acc.archivedAt))
const archived = computed(() => (accounts.value ?? []).filter((acc) => acc.archivedAt))
const names = ref<Record<string, string>>({})
watch(
  accounts,
  (list) => {
    names.value = Object.fromEntries((list ?? []).map((acc) => [acc.id, acc.name]))
  },
  { immediate: true },
)

async function patch(id: string, body: Record<string, unknown>): Promise<void> {
  try {
    await apiFetch(`/api/accounts/${id}`, { method: 'PATCH', body })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
  await refresh()
}

async function rename(acc: AccountDto): Promise<void> {
  const name = (names.value[acc.id] ?? '').trim()
  if (!name || name === acc.name) {
    names.value[acc.id] = acc.name
    return
  }
  await patch(acc.id, { name })
}

/** Saves the order of the active list; archived accounts keep their place after it. */
async function saveOrder(ids: string[]): Promise<void> {
  try {
    accounts.value = await apiFetch<AccountDto[]>('/api/accounts/order', {
      method: 'POST',
      body: { ids: [...ids, ...archived.value.map((acc) => acc.id)] },
    })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
    await refresh()
  }
}

function move(index: number, delta: number): void {
  const ids = active.value.map((acc) => acc.id)
  const target = index + delta
  if (target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  void saveOrder(ids)
}

const dragged = ref<number | null>(null)
function drop(index: number): void {
  if (dragged.value === null || dragged.value === index) return
  const ids = active.value.map((acc) => acc.id)
  const [moved] = ids.splice(dragged.value, 1)
  ids.splice(index, 0, moved!)
  dragged.value = null
  void saveOrder(ids)
}

function blurOnEnter(event: KeyboardEvent): void {
  ;(event.target as HTMLInputElement).blur()
}
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('settings.accountsPage.active') }}</h2>
        <p class="text-sm text-muted">{{ t('settings.accountsPage.hint') }}</p>
      </template>
      <ul class="divide-y divide-default" data-testid="account-settings">
        <li
          v-for="(acc, index) in active"
          :key="acc.id"
          class="flex items-center gap-2 py-2"
          draggable="true"
          data-testid="account-setting"
          :data-name="acc.name"
          @dragstart="dragged = index"
          @dragover.prevent
          @drop="drop(index)"
        >
          <UIcon
            name="i-lucide-grip-vertical"
            class="hidden size-4 shrink-0 cursor-grab text-muted sm:block"
          />
          <MerchantLogo :name="acc.institutionName" :logo="acc.logo" />
          <div class="min-w-0 flex-1">
            <UInput
              v-model="names[acc.id]"
              size="sm"
              class="w-full"
              :maxlength="80"
              :aria-label="t('settings.accountsPage.name')"
              data-testid="account-name"
              @blur="rename(acc)"
              @keydown.enter="blurOnEnter"
            />
            <p class="mt-0.5 truncate text-xs text-muted">{{ acc.institutionName }}</p>
          </div>
          <div class="flex shrink-0 items-center">
            <UButton
              icon="i-lucide-arrow-up"
              color="neutral"
              variant="ghost"
              size="sm"
              class="hidden sm:inline-flex"
              :disabled="index === 0"
              :aria-label="t('settings.accountsPage.up')"
              data-testid="account-up"
              @click="move(index, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="index === active.length - 1"
              :aria-label="t('settings.accountsPage.down')"
              data-testid="account-down"
              @click="move(index, 1)"
            />
            <UButton
              :icon="acc.isHidden ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="
                acc.isHidden ? t('settings.accountsPage.show') : t('settings.accountsPage.hide')
              "
              :aria-pressed="acc.isHidden"
              data-testid="account-hide"
              @click="patch(acc.id, { isHidden: !acc.isHidden })"
            />
            <UButton
              icon="i-lucide-archive"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="t('settings.accountsPage.archive')"
              data-testid="account-archive"
              @click="patch(acc.id, { archived: true })"
            />
          </div>
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('settings.accountsPage.archived') }}</h2>
      </template>
      <p v-if="archived.length === 0" class="text-sm text-muted">
        {{ t('settings.accountsPage.noneArchived') }}
      </p>
      <ul v-else class="divide-y divide-default" data-testid="archived-accounts">
        <li v-for="acc in archived" :key="acc.id" class="flex items-center gap-2 py-2">
          <MerchantLogo :name="acc.institutionName" :logo="acc.logo" />
          <span class="min-w-0 flex-1 truncate">{{ acc.name }}</span>
          <UButton
            icon="i-lucide-archive-restore"
            color="neutral"
            variant="soft"
            size="sm"
            :label="t('settings.accountsPage.restore')"
            data-testid="account-restore"
            @click="patch(acc.id, { archived: false })"
          />
        </li>
      </ul>
      <USwitch
        class="mt-4"
        :model-value="settings.archivedInSums"
        :label="t('settings.accountsPage.archivedInSums')"
        data-testid="archived-in-sums"
        @update:model-value="update({ archivedInSums: $event })"
      />
    </UCard>
  </div>
</template>
