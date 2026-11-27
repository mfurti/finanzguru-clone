<script setup lang="ts">
import type { Period, WatchlistDto, WatchlistEntryDto, WatchlistSummary } from '@finance/shared'
import type { FetchError } from 'ofetch'

/**
 * Watchlist like the reference (012 P10): one tab per watchlist plus "Neue Watchlist"; the
 * active list shows its number of securities, a period switch, "Hinzufügen" and a ⋮ menu
 * (umbenennen, löschen); empty lists invite to add the first security. A first watchlist
 * exists from the start (API).
 */
const { t } = useI18n()
useHead({ title: t('investments.views.watchlists') })
const route = useRoute()
const router = useRouter()

const { data: lists, refresh: refreshLists } = await useApi<WatchlistSummary[]>('/api/watchlists', {
  default: () => [],
})
const activeId = computed(() => {
  const wanted = typeof route.query.id === 'string' ? route.query.id : null
  return lists.value?.find((list) => list.id === wanted)?.id ?? lists.value?.[0]?.id ?? null
})
function select(id: string): void {
  void router.replace({ query: { ...route.query, id } })
}

const period = ref<Period>(useDefaultPeriod())
const { data: detail, refresh: refreshDetail } = await useApi<WatchlistDto | null>(
  () => (activeId.value ? `/api/watchlists/${activeId.value}` : ''),
  { query: { period }, default: () => null, watch: [activeId] },
)
async function refreshAll(): Promise<void> {
  await Promise.all([refreshDetail(), refreshLists()])
}

const searchOpen = ref(false)
const toast = useToast()
const error = ref<string | null>(null)

/** Name dialog for "Neue Watchlist" and "Umbenennen". */
const nameOpen = ref(false)
const nameMode = ref<'create' | 'rename'>('create')
const name = ref('')
function openName(mode: 'create' | 'rename'): void {
  nameMode.value = mode
  name.value = mode === 'rename' ? (detail.value?.name ?? '') : ''
  error.value = null
  nameOpen.value = true
}
async function saveName(): Promise<void> {
  error.value = null
  try {
    if (nameMode.value === 'create') {
      const created = await apiFetch<WatchlistSummary>('/api/watchlists', {
        method: 'POST',
        body: { name: name.value.trim() },
      })
      await refreshLists()
      select(created.id)
    } else if (activeId.value) {
      await apiFetch(`/api/watchlists/${activeId.value}`, {
        method: 'PATCH',
        body: { name: name.value.trim() },
      })
      await refreshAll()
    }
    nameOpen.value = false
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? String(cause)
  }
}
async function removeList(): Promise<void> {
  if (!activeId.value) return
  await apiFetch(`/api/watchlists/${activeId.value}`, { method: 'DELETE' })
  await router.replace({ query: { ...route.query, id: undefined } })
  await refreshLists()
}
async function removeEntry(entry: WatchlistEntryDto): Promise<void> {
  await apiFetch(`/api/watchlists/${activeId.value}/entries/${entry.instrumentId}`, {
    method: 'DELETE',
  })
  await refreshAll()
}

const refreshing = ref(false)
/** Fetches fresh quotes through the Scalable connection (005 US4), then reloads the list. */
async function refreshQuotes(): Promise<void> {
  refreshing.value = true
  try {
    await apiFetch('/api/market-data/refresh', { method: 'POST' })
    await refreshDetail()
  } catch {
    toast.add({ title: t('marketData.unavailable'), color: 'warning' })
  } finally {
    refreshing.value = false
  }
}

const menu = computed(() => [
  [
    {
      label: t('watchlists.rename'),
      icon: 'i-lucide-pencil',
      onSelect: () => openName('rename'),
    },
    {
      label: t('marketData.refresh'),
      icon: 'i-lucide-refresh-cw',
      onSelect: () => void refreshQuotes(),
    },
  ],
  [
    {
      label: t('watchlists.deleteList'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => void removeList(),
    },
  ],
])
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('investments.views.watchlists') }}</h1>
    <UCard :ui="{ header: 'p-0 sm:p-0' }" data-testid="watchlist-page">
      <template #header>
        <div
          class="flex gap-6 overflow-x-auto border-b border-default px-4 pt-4 [scrollbar-width:none] sm:px-6"
          role="tablist"
          data-testid="watchlist-tabs"
        >
          <button
            v-for="list in lists ?? []"
            :key="list.id"
            type="button"
            role="tab"
            :aria-selected="list.id === activeId"
            class="-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors"
            :class="
              list.id === activeId
                ? 'border-(--ui-text-highlighted) text-highlighted'
                : 'border-transparent text-muted hover:text-default'
            "
            data-testid="watchlist-tab"
            @click="select(list.id)"
          >
            {{ list.name }}
          </button>
          <button
            type="button"
            class="-mb-px flex shrink-0 items-center gap-1 border-b-2 border-transparent pb-3 text-sm text-muted transition-colors hover:text-default"
            data-testid="watchlist-create"
            @click="openName('create')"
          >
            <UIcon name="i-lucide-plus" class="size-4" />
            {{ t('watchlists.new') }}
          </button>
        </div>
      </template>

      <template v-if="detail">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-semibold" data-testid="watchlist-count">
            {{ t('watchlists.count', { n: detail.entries.length }) }}
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            <PeriodTabs v-model="period" />
            <UButton
              icon="i-lucide-plus"
              :label="t('watchlists.addButton')"
              data-testid="asset-search-open"
              @click="searchOpen = true"
            />
            <UDropdownMenu :items="menu" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                variant="ghost"
                color="neutral"
                :loading="refreshing"
                :aria-label="t('watchlists.menu')"
                data-testid="watchlist-menu"
              />
            </UDropdownMenu>
          </div>
        </div>

        <div
          v-if="detail.entries.length === 0"
          class="flex flex-col items-center gap-2 py-16 text-center"
          data-testid="watchlist-empty"
        >
          <UIcon name="i-lucide-eye" class="size-8 text-muted" />
          <p class="font-semibold">{{ t('watchlists.empty') }}</p>
          <p class="text-sm text-muted">{{ t('watchlists.emptyHint') }}</p>
          <UButton
            class="mt-2"
            icon="i-lucide-plus"
            :label="t('watchlists.addFirst')"
            data-testid="watchlist-add-first"
            @click="searchOpen = true"
          />
        </div>
        <div v-else class="space-y-4">
          <WatchlistTable :entries="detail.entries" @remove="removeEntry" />
          <AddSecurityForm :watchlist-id="detail.id" @added="refreshAll()" />
        </div>
        <AssetSearchDialog
          v-model:open="searchOpen"
          :watchlist-id="detail.id"
          :trigger="false"
          @added="refreshAll()"
        />
      </template>
    </UCard>

    <UModal
      v-model:open="nameOpen"
      :title="nameMode === 'create' ? t('watchlists.new') : t('watchlists.rename')"
    >
      <template #body>
        <form class="space-y-3" @submit.prevent="saveName">
          <UInput
            v-model="name"
            maxlength="60"
            :placeholder="t('watchlists.name')"
            class="w-full"
            autofocus
            data-testid="watchlist-new-name"
          />
          <UAlert v-if="error" color="error" variant="subtle" :title="error" />
          <div class="flex justify-end">
            <UButton
              type="submit"
              :label="t('common.save')"
              :disabled="!name.trim()"
              data-testid="watchlist-name-save"
            />
          </div>
        </form>
      </template>
    </UModal>
  </section>
</template>
