<script setup lang="ts">
import { type AllocationResponse, formatEur, formatPct } from '@finance/shared'
import { VisDonut, VisSingleContainer } from '@unovis/vue'

/** "Aufteilung": net worth by asset class plus cash, € or %. */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const unit = ref<'eur' | 'pct'>('eur')

const { data } = await useApi<AllocationResponse>('/api/overview/allocation', {
  query: { accounts: accountsParam },
  default: () => ({ totalCents: 0, slices: [] }),
})

/** Fixed palette per slice key so colors stay stable between filters. */
const COLORS: Record<string, string> = {
  etf: 'var(--color-emerald-500)',
  stock: 'var(--color-indigo-500)',
  fund: 'var(--color-violet-500)',
  bond: 'var(--color-amber-500)',
  crypto: 'var(--color-orange-500)',
  commodity: 'var(--color-yellow-600)',
  other: 'var(--color-zinc-500)',
  cash: 'var(--color-sky-500)',
}

type Slice = AllocationResponse['slices'][number]
const slices = computed(() => (data.value?.slices ?? []).filter((slice) => slice.valueCents > 0))
const value = (slice: Slice) => slice.valueCents
const color = (slice: Slice) => COLORS[slice.key] ?? COLORS.other!
const display = (slice: Slice) =>
  unit.value === 'eur' ? formatEur(slice.valueCents) : formatPct(Number(slice.pct ?? 0))
</script>

<template>
  <UCard data-testid="allocation-card">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('overview.allocation.title') }}</h2>
        <UFieldGroup size="xs">
          <UButton
            :variant="unit === 'eur' ? 'soft' : 'ghost'"
            color="neutral"
            label="€"
            @click="unit = 'eur'"
          />
          <UButton
            :variant="unit === 'pct' ? 'soft' : 'ghost'"
            color="neutral"
            label="%"
            @click="unit = 'pct'"
          />
        </UFieldGroup>
      </div>
    </template>

    <EmptyState
      v-if="slices.length === 0"
      :title="t('overview.empty.title')"
      icon="i-lucide-chart-pie"
    />
    <div v-else class="flex flex-col items-center gap-4 sm:flex-row">
      <div class="relative size-44 shrink-0">
        <ClientOnly>
          <VisSingleContainer :data="slices" :height="176">
            <VisDonut :value="value" :color="color" :arc-width="22" :pad-angle="0.01" />
          </VisSingleContainer>
        </ClientOnly>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span class="font-semibold"><Money :cents="data!.totalCents" /></span>
          <span class="text-xs text-muted">{{ t('overview.allocation.center') }}</span>
        </div>
      </div>
      <ul class="w-full divide-y divide-default text-sm">
        <li
          v-for="slice in slices"
          :key="slice.key"
          class="flex items-center justify-between gap-3 py-2"
        >
          <span class="flex items-center gap-2">
            <span class="size-3 rounded-sm" :style="{ background: color(slice) }" />
            {{ slice.label }}
            <span v-if="slice.key !== 'cash'" class="text-muted">({{ slice.count }})</span>
          </span>
          <span class="tabular-nums">{{ display(slice) }}</span>
        </li>
      </ul>
    </div>
  </UCard>
</template>
