<script setup lang="ts">
import type { SearchResult } from '@finance/shared'

/**
 * Global search (003 US7, FR-003): magnifier in the header or Ctrl/Cmd+K.
 * Queries the own API 200 ms after typing stops (min. 2 characters); results
 * grouped into pages, securities, accounts and bookings. Enter opens a hit.
 */
const { t } = useI18n()
const open = ref(false)
const term = ref('')
const result = ref<SearchResult | null>(null)
const loading = ref(false)

defineShortcuts({ meta_k: () => (open.value = !open.value) })

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(term, (value) => {
  clearTimeout(timer)
  const q = value.trim()
  if (q.length < 2) {
    result.value = null
    loading.value = false
    return
  }
  loading.value = true
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const data = await apiFetch<SearchResult>('/api/search', { query: { q } })
      if (mine === seq) result.value = data
    } finally {
      if (mine === seq) loading.value = false
    }
  }, 200)
})
watch(open, (isOpen) => {
  if (!isOpen) term.value = ''
})
onBeforeUnmount(() => clearTimeout(timer))

const ICONS: Record<keyof SearchResult, string> = {
  pages: 'i-lucide-file-text',
  instruments: 'i-lucide-chart-candlestick',
  accounts: 'i-lucide-wallet',
  transactions: 'i-lucide-receipt',
}
const groups = computed(() =>
  result.value
    ? (Object.keys(ICONS) as (keyof SearchResult)[])
        .filter((key) => result.value![key].length > 0)
        .map((key) => ({
          id: key,
          label: t(`search.groups.${key}`),
          ignoreFilter: true,
          items: result.value![key].map((hit) => ({
            label: hit.label,
            suffix: hit.sub,
            icon: ICONS[key],
            onSelect: () => {
              open.value = false
              void navigateTo(hit.to)
            },
          })),
        }))
    : [],
)
const emptyText = computed(() =>
  term.value.trim().length < 2 ? t('search.minChars') : loading.value ? '…' : t('search.empty'),
)
</script>

<template>
  <UModal v-model:open="open" :title="t('search.open')" :ui="{ content: 'p-0' }">
    <UButton
      icon="i-lucide-search"
      color="neutral"
      variant="ghost"
      :aria-label="t('search.open')"
      aria-keyshortcuts="Control+K Meta+K"
      data-testid="search-open"
    />
    <template #content>
      <UCommandPalette
        v-model:search-term="term"
        :groups="groups"
        :loading="loading"
        :placeholder="t('search.placeholder')"
        class="h-96"
        data-testid="search-palette"
        close
        @update:open="(value: boolean) => (open = value)"
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-muted" data-testid="search-empty">
            {{ emptyText }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
