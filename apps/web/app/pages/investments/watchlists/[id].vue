<script setup lang="ts">
import type { Period, WatchlistDto, WatchlistEntryDto } from '@finance/shared'

/** One watchlist (US6): period switch, entries, add/remove, rename. */
const { t } = useI18n()
const route = useRoute()
const period = ref<Period>('1Y')

const { data, refresh } = await useApi<WatchlistDto>(() => `/api/watchlists/${route.params.id}`, {
  query: { period },
})
useHead({ title: () => data.value?.name ?? t('watchlists.title') })

const renaming = ref(false)
const newName = ref('')
function startRename(): void {
  newName.value = data.value?.name ?? ''
  renaming.value = true
}
async function rename(): Promise<void> {
  await apiFetch(`/api/watchlists/${route.params.id}`, {
    method: 'PATCH',
    body: { name: newName.value.trim() },
  })
  renaming.value = false
  await refresh()
}
const toast = useToast()
const refreshing = ref(false)
/** Fetches fresh quotes through the Scalable connection (005 US4), then reloads the list. */
async function refreshQuotes(): Promise<void> {
  refreshing.value = true
  try {
    await apiFetch('/api/market-data/refresh', { method: 'POST' })
    await refresh()
  } catch {
    toast.add({ title: t('marketData.unavailable'), color: 'warning' })
  } finally {
    refreshing.value = false
  }
}

async function remove(entry: WatchlistEntryDto): Promise<void> {
  await apiFetch(`/api/watchlists/${route.params.id}/entries/${entry.instrumentId}`, {
    method: 'DELETE',
  })
  await refresh()
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="sr-only">{{ t('nav.investments') }}</h1>
    <UButton
      to="/investments/watchlists"
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
      :label="t('watchlists.title')"
      class="-ml-2"
    />
    <UCard v-if="data" data-testid="watchlist-detail">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <form v-if="renaming" class="flex gap-2" @submit.prevent="rename">
            <UInput v-model="newName" maxlength="60" size="sm" />
            <UButton
              type="submit"
              size="sm"
              :label="t('common.save')"
              :disabled="!newName.trim()"
            />
          </form>
          <h2 v-else class="flex items-center gap-1 font-semibold">
            {{ data.name }}
            <UButton
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              color="neutral"
              :aria-label="t('watchlists.rename')"
              @click="startRename"
            />
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              size="xs"
              variant="soft"
              color="neutral"
              :loading="refreshing"
              :label="t('marketData.refresh')"
              data-testid="watchlist-refresh"
              @click="refreshQuotes"
            />
            <PeriodTabs v-model="period" />
          </div>
        </div>
      </template>
      <div class="space-y-4">
        <AssetSearchDialog :watchlist-id="data.id" @added="refresh()" />
        <AddSecurityForm :watchlist-id="data.id" @added="refresh()" />
        <WatchlistTable :entries="data.entries" @remove="remove" />
      </div>
    </UCard>
  </section>
</template>
