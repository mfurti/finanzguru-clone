<script setup lang="ts">
import { type AllocationResponse, formatEur, formatPct } from '@finance/shared'

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
const color = (slice: Slice) => COLORS[slice.key] ?? COLORS.other!
const hovered = ref<string | null>(null)
const donutItems = computed(() =>
  slices.value.map((slice) => ({
    key: slice.key,
    value: slice.valueCents,
    color: color(slice),
    label: slice.label,
  })),
)
const display = (slice: Slice) =>
  unit.value === 'eur' ? formatEur(slice.valueCents) : formatPct(Number(slice.pct ?? 0))
</script>

<template>
  <UCard data-testid="allocation-card">
    <template #header>
      <CardTitle :title="t('overview.allocation.title')" to="/investments" />
    </template>

    <EmptyState
      v-if="slices.length === 0"
      :title="t('overview.empty.title')"
      icon="i-lucide-chart-pie"
    />
    <div v-else class="@container">
      <div class="flex flex-col items-center gap-4 @lg:flex-row">
        <DonutChart v-model:hovered="hovered" :items="donutItems">
          <template #center="{ item }">
            <span class="font-semibold">
              <Money v-if="item" :cents="item.value" />
              <Money v-else :cents="data!.totalCents" animate />
            </span>
            <span class="line-clamp-2 text-xs text-muted">
              {{ item ? item.label : t('overview.allocation.center') }}
            </span>
          </template>
        </DonutChart>
        <ul class="w-full divide-y divide-default text-sm">
          <li
            v-for="slice in slices"
            :key="slice.key"
            class="row-hover flex items-center justify-between gap-3 py-2"
            :class="{ 'bg-elevated/70': hovered === slice.key }"
            @mouseenter="hovered = slice.key"
            @mouseleave="hovered = null"
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
      <!-- €/% below right of the donut like the reference (007 US3). -->
      <div class="mt-2 flex justify-end">
        <UFieldGroup size="xs" data-testid="allocation-unit">
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
    </div>
  </UCard>
</template>
