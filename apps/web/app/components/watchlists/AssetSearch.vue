<script setup lang="ts">
import type { AssetClass, SecurityHit, SecuritySearchResponse, WatchlistDto } from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * "Asset suchen" panel (005 US4, FR-013): search by name, ISIN or WKN through the Scalable
 * connection, narrow by class chips, add a hit to this watchlist. Results come grouped by
 * class; "Mehr anzeigen" switches to that class, which lists more hits.
 */
const props = defineProps<{ watchlistId: string }>()
const emit = defineEmits<{ added: [] }>()
const { t } = useI18n()
const toast = useToast()

const query = ref('')
const assetClass = ref<AssetClass | null>(null)
const result = ref<SecuritySearchResponse | null>(null)
const loading = ref(false)
const adding = ref<string | null>(null)
const CHIPS: AssetClass[] = ['stock', 'etf', 'fund', 'bond', 'crypto', 'commodity', 'other']

let timer: ReturnType<typeof setTimeout> | undefined
let sequence = 0
/** Debounced search (300 ms, at least 2 characters); late answers of older queries are dropped. */
watch([query, assetClass], () => {
  clearTimeout(timer)
  const text = query.value.trim()
  if (text.length < 2) {
    result.value = null
    return
  }
  timer = setTimeout(() => void search(text), 300)
})

async function search(text: string): Promise<void> {
  const current = ++sequence
  loading.value = true
  try {
    const response = await apiFetch<SecuritySearchResponse>('/api/market-data/search', {
      query: { q: text, class: assetClass.value ?? undefined },
    })
    if (current === sequence) result.value = response
  } catch {
    if (current === sequence) toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    if (current === sequence) loading.value = false
  }
}

async function add(hit: SecurityHit): Promise<void> {
  adding.value = hit.isin
  try {
    const list = await apiFetch<WatchlistDto>(`/api/watchlists/${props.watchlistId}/entries`, {
      method: 'POST',
      body: { isin: hit.isin, name: hit.name, assetClass: hit.assetClass },
    })
    // Load a month of closes so the new row has a price and a sparkline right away.
    const added = list.entries.find((entry) => entry.isin === hit.isin)
    if (added) {
      await apiFetch(`/api/market-data/chart/${added.instrumentId}`, {
        query: { range: '1M' },
      }).catch(() => undefined)
    }
    toast.add({ title: t('marketData.added'), description: hit.name, color: 'success' })
    emit('added')
  } catch (error) {
    const duplicate = error instanceof FetchError && error.statusCode === 409
    toast.add({
      title: duplicate ? t('marketData.duplicate') : t('common.error'),
      color: duplicate ? 'warning' : 'error',
    })
  } finally {
    adding.value = null
  }
}

const empty = computed(
  () => result.value?.available && result.value.groups.every((group) => group.hits.length === 0),
)
</script>

<template>
  <div class="space-y-3" data-testid="asset-search">
    <UInput
      v-model="query"
      icon="i-lucide-search"
      :placeholder="t('marketData.placeholder')"
      :loading="loading"
      autofocus
      class="w-full"
      data-testid="asset-search-input"
    />
    <div class="flex flex-wrap gap-1.5">
      <UButton
        size="xs"
        :variant="assetClass === null ? 'soft' : 'ghost'"
        color="neutral"
        :label="t('investments.classChips.all')"
        data-testid="asset-search-chip-all"
        @click="assetClass = null"
      />
      <UButton
        v-for="chip in CHIPS"
        :key="chip"
        size="xs"
        :variant="assetClass === chip ? 'soft' : 'ghost'"
        color="neutral"
        :label="t(`assetClasses.${chip}`)"
        :aria-pressed="assetClass === chip"
        :data-testid="`asset-search-chip-${chip}`"
        @click="assetClass = chip"
      />
    </div>

    <p v-if="query.trim().length < 2" class="text-sm text-muted">
      {{ t('marketData.minChars') }}
    </p>
    <div
      v-else-if="result && !result.available"
      class="space-y-2 text-sm"
      data-testid="asset-search-unavailable"
    >
      <p>{{ t('marketData.unavailable') }}</p>
      <UButton to="/settings/sources" size="sm" variant="soft" :label="t('marketData.toSources')" />
    </div>
    <p v-else-if="empty" class="text-sm text-muted">{{ t('marketData.noResults') }}</p>

    <div v-for="group in result?.groups ?? []" :key="group.assetClass" class="space-y-1">
      <h3 class="text-xs font-medium text-muted uppercase">
        {{ t(`assetClasses.${group.assetClass}`) }}
      </h3>
      <ul class="divide-y divide-default" :data-testid="`asset-search-group-${group.assetClass}`">
        <li
          v-for="hit in group.hits"
          :key="hit.isin"
          class="flex items-center justify-between gap-3 py-1.5"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">{{ hit.name }}</p>
            <p class="text-xs text-muted tabular-nums">{{ hit.isin }}</p>
          </div>
          <UButton
            size="xs"
            icon="i-lucide-plus"
            variant="soft"
            :label="t('marketData.add')"
            :loading="adding === hit.isin"
            :data-testid="`asset-search-add-${hit.isin}`"
            @click="add(hit)"
          />
        </li>
      </ul>
      <UButton
        v-if="group.more && assetClass === null"
        size="xs"
        variant="link"
        :label="t('marketData.more')"
        :data-testid="`asset-search-more-${group.assetClass}`"
        @click="assetClass = group.assetClass"
      />
    </div>
  </div>
</template>
