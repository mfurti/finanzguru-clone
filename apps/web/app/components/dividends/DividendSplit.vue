<script setup lang="ts">
import type { DividendSummary } from '@finance/shared'

/**
 * "Aufteilung" of the dividends (003 US5, FR-016): by security, region or
 * sector (instrument weights from 002), as donut plus list.
 */
const props = defineProps<{ summary: DividendSummary }>()
const { t } = useI18n()
const by = ref<'security' | 'region' | 'sector'>('security')
const hovered = ref<string | null>(null)

const rows = computed(() => {
  if (by.value === 'security') {
    return props.summary.bySecurity.map((row) => ({
      key: row.instrumentId,
      label: row.name,
      cents: row.cents,
      pct: row.pct,
      to: `/investments/${row.instrumentId}`,
    }))
  }
  const list = by.value === 'region' ? props.summary.byRegion : props.summary.bySector
  return list.map((row) => ({ ...row, to: null as string | null }))
})
const colorOf = (key: string, label: string) =>
  key === 'unassigned' ? 'var(--color-zinc-500)' : nameHex(label)
const donut = computed(() =>
  rows.value.map((row) => ({
    key: row.key,
    value: row.cents,
    color: colorOf(row.key, row.label),
    label: row.label,
  })),
)
const tabs = computed(() => [
  { value: 'security' as const, label: t('refine.bySecurity') },
  { value: 'region' as const, label: t('refine.byRegion') },
  { value: 'sector' as const, label: t('refine.bySector') },
])
</script>

<template>
  <UCard data-testid="dividend-split">
    <template #header>
      <div class="flex flex-wrap items-end justify-between gap-2">
        <h2 class="font-semibold">{{ t('refine.split') }}</h2>
        <div class="flex gap-4" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            role="tab"
            :aria-selected="by === tab.value"
            class="border-b-2 pb-1 text-sm font-medium transition-colors"
            :class="
              by === tab.value
                ? 'border-(--ui-text-highlighted) text-highlighted'
                : 'border-transparent text-muted hover:text-default'
            "
            :data-testid="`dividend-split-${tab.value}`"
            @click="by = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </template>
    <p v-if="rows.length === 0" class="text-sm text-muted">{{ t('dividends.empty') }}</p>
    <div v-else class="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
      <DonutChart v-model:hovered="hovered" :items="donut" :size="160" :thickness="20" />
      <ul
        class="divide-y divide-default text-sm"
        :data-testid="by === 'security' ? 'dividends-by-security' : `dividends-by-${by}`"
      >
        <li
          v-for="row in rows"
          :key="row.key"
          class="row-hover flex items-center justify-between gap-3 py-2"
          :class="{ 'bg-(--app-card-hover)': hovered === row.key }"
          @mouseenter="hovered = row.key"
          @mouseleave="hovered = null"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span
              class="size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: colorOf(row.key, row.label) }"
            />
            <NuxtLink v-if="row.to" :to="row.to" class="link-hover truncate">{{
              row.label
            }}</NuxtLink>
            <span v-else class="truncate">{{ row.label }}</span>
          </span>
          <span class="flex shrink-0 gap-3">
            <Percent :value="row.pct" class="text-muted" />
            <Money :cents="row.cents" />
          </span>
        </li>
      </ul>
    </div>
  </UCard>
</template>
