<script setup lang="ts">
import type { Holding, TopFlopResponse } from '@finance/shared'

/** "Holdings": best and worst positions by price change in a range. */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const range = ref<'1D' | '1W' | '1M' | '1Y'>('1D')
const rangeItems = computed(() =>
  (['1D', '1W', '1M', '1Y'] as const).map((value) => ({
    value,
    label: t(`overview.holdings.range.${value}`),
  })),
)

const { data } = await useApi<TopFlopResponse>('/api/overview/holdings/top-flop', {
  query: { range, accounts: accountsParam },
  default: () => ({ top: [], flop: [] }),
})

const groups = computed<{ key: 'top' | 'flop'; items: Holding[] }[]>(() => [
  { key: 'top', items: data.value?.top ?? [] },
  { key: 'flop', items: data.value?.flop ?? [] },
])
</script>

<template>
  <UCard data-testid="holdings-card">
    <template #header>
      <CardTitle :title="t('overview.holdings.title')" to="/investments">
        <USelect v-model="range" :items="rangeItems" size="sm" class="w-28" />
      </CardTitle>
    </template>

    <!-- Top and Flop side by side from 768 px (007 US3). -->
    <div class="grid gap-4 md:grid-cols-2" data-testid="holdings-groups">
      <section v-for="group in groups" :key="group.key">
        <h3 class="mb-1 text-sm text-muted">{{ t(`overview.holdings.${group.key}`) }}</h3>
        <p v-if="group.items.length === 0" class="text-sm text-muted">–</p>
        <ul v-else class="divide-y divide-default">
          <li
            v-for="item in group.items"
            :key="item.instrumentId"
            class="row-hover flex items-center justify-between gap-3 py-2 text-sm"
          >
            <NuxtLink
              :to="`/investments/${item.instrumentId}`"
              class="flex min-w-0 items-center gap-2 link-hover"
            >
              <Avatar :name="item.name" size="sm" />
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ item.name }}</span>
                <span class="text-xs text-muted"><Money :cents="item.priceCents" /></span>
              </span>
            </NuxtLink>
            <span class="text-right">
              <Percent :value="item.changePct" signed class="block" />
              <Money :cents="item.changeCents" signed class="text-xs" />
            </span>
          </li>
        </ul>
      </section>
    </div>
  </UCard>
</template>
