<script setup lang="ts">
import type { WatchlistSummary } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Watchlists overview (US6): create, open, rename, delete. */
const { t } = useI18n()
useHead({ title: t('watchlists.title') })

const { data: lists, refresh } = await useApi<WatchlistSummary[]>('/api/watchlists', {
  default: () => [],
})
const name = ref('')
const error = ref<string | null>(null)

async function create(): Promise<void> {
  error.value = null
  try {
    const created = await apiFetch<WatchlistSummary>('/api/watchlists', {
      method: 'POST',
      body: { name: name.value.trim() },
    })
    name.value = ''
    await navigateTo(`/investments/watchlists/${created.id}`)
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? String(cause)
  }
}
async function remove(id: string): Promise<void> {
  await apiFetch(`/api/watchlists/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.investments') }}</h1>
    <InvestmentsNav />
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('watchlists.title') }}</h2>
      </template>
      <form class="mb-4 flex gap-2" @submit.prevent="create">
        <UInput
          v-model="name"
          :placeholder="t('watchlists.new')"
          maxlength="60"
          class="flex-1"
          data-testid="watchlist-new-name"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          :label="t('common.add')"
          :disabled="!name.trim()"
          data-testid="watchlist-create"
        />
      </form>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" class="mb-3" />
      <EmptyState
        v-if="(lists ?? []).length === 0"
        :title="t('watchlists.emptyLists')"
        icon="i-lucide-eye"
      />
      <ul v-else class="divide-y divide-default text-sm" data-testid="watchlist-list">
        <li
          v-for="list in lists"
          :key="list.id"
          class="row-hover flex items-center justify-between gap-3 py-2"
        >
          <NuxtLink :to="`/investments/watchlists/${list.id}`" class="link-hover font-medium">
            {{ list.name }}
          </NuxtLink>
          <span class="flex items-center gap-2 text-muted">
            {{ t('watchlists.count', { n: list.count }) }}
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              color="neutral"
              :aria-label="t('common.delete')"
              data-testid="watchlist-delete"
              @click="remove(list.id)"
            />
          </span>
        </li>
      </ul>
    </UCard>
  </section>
</template>
