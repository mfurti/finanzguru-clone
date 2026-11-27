<script setup lang="ts">
import {
  BREAKDOWN_DIMENSIONS,
  type BreakdownBucket,
  type BreakdownDimension,
  type BreakdownResponse,
  type GroupingDto,
} from '@finance/shared'
import { formatEur, formatPct } from '~/utils/privacy'

/** Portfolio split by asset class, region, sector, … or an own grouping (US1). */
const { t } = useI18n()
const { accountsParam } = useAccountFilter()
const dimension = ref<BreakdownDimension>('assetClass')
const unit = ref<'eur' | 'pct'>('eur')
const editorOpen = ref(false)

const { data: groupings, refresh: refreshGroupings } = await useApi<GroupingDto[]>(
  '/api/groupings',
  { key: 'groupings', default: () => [] },
)
const groupingId = ref<string | undefined>(groupings.value?.[0]?.id)
watch(groupings, (list) => {
  if (!list?.some((g) => g.id === groupingId.value)) groupingId.value = list?.[0]?.id
})

const query = computed(() => ({
  dimension: dimension.value,
  accounts: accountsParam.value,
  groupingId: dimension.value === 'grouping' ? groupingId.value : undefined,
}))
const skip = computed(() => dimension.value === 'grouping' && !groupingId.value)
const { data, refresh } = await useApi<BreakdownResponse>('/api/analysis/breakdown', {
  query,
  default: () => ({ totalCents: 0, buckets: [] }),
  immediate: !skip.value,
  watch: false,
})
watch([query, skip], () => {
  if (!skip.value) void refresh()
})

const buckets = computed(() =>
  skip.value ? [] : (data.value?.buckets ?? []).filter((b) => b.valueCents > 0),
)
const colors = computed(() => new Map(buckets.value.map((b, i) => [b.key, paletteColor(i, b.key)])))
const color = (bucket: BreakdownBucket) => colors.value.get(bucket.key)!
const hovered = ref<string | null>(null)
const donutItems = computed(() =>
  buckets.value.map((bucket) => ({
    key: bucket.key,
    value: bucket.valueCents,
    color: color(bucket),
    label: bucket.label,
  })),
)
const display = (bucket: BreakdownBucket) =>
  unit.value === 'eur' ? formatEur(bucket.valueCents) : formatPct(Number(bucket.pct ?? 0))

const tabs = computed(() =>
  BREAKDOWN_DIMENSIONS.map((key) => ({ label: t(`analysis.dimensions.${key}`), value: key })),
)
const groupingItems = computed(() =>
  (groupings.value ?? []).map((g) => ({ label: g.name, value: g.id })),
)

async function onSaved(id?: string): Promise<void> {
  await refreshGroupings()
  if (id) groupingId.value = id
  await refresh()
}
</script>

<template>
  <UCard data-testid="breakdown-card">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('analysis.breakdown') }}</h2>
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

    <div class="mb-4 overflow-x-auto [scrollbar-width:none]">
      <UTabs
        v-model="dimension"
        :items="tabs"
        :content="false"
        size="sm"
        class="min-w-max"
        data-testid="breakdown-tabs"
      />
    </div>

    <div v-if="dimension === 'grouping'" class="mb-4 flex flex-wrap items-center gap-2">
      <USelect
        v-if="groupingItems.length > 0"
        v-model="groupingId"
        :items="groupingItems"
        class="w-48"
        data-testid="grouping-select"
      />
      <span v-else class="text-sm text-muted">{{ t('analysis.grouping.none') }}</span>
      <UButton
        size="sm"
        variant="soft"
        color="neutral"
        icon="i-lucide-settings-2"
        :label="t('analysis.grouping.manage')"
        data-testid="grouping-manage"
        @click="editorOpen = true"
      />
    </div>

    <EmptyState
      v-if="buckets.length === 0"
      :title="t('analysis.empty')"
      icon="i-lucide-chart-pie"
    />
    <div v-else class="@container">
      <div class="flex flex-col items-center gap-4 @lg:flex-row @lg:items-start">
        <DonutChart v-model:hovered="hovered" :items="donutItems">
          <template #center="{ item }">
            <span class="font-semibold">
              <Money v-if="item" :cents="item.value" />
              <Money v-else :cents="data!.totalCents" animate />
            </span>
            <span class="line-clamp-2 text-xs text-muted">
              {{ item ? item.label : t('analysis.dimensions.' + dimension) }}
            </span>
          </template>
        </DonutChart>
        <ul class="w-full divide-y divide-default text-sm" data-testid="breakdown-list">
          <li
            v-for="bucket in buckets"
            :key="bucket.key"
            class="row-hover flex items-center justify-between gap-3 py-2"
            :class="{ 'bg-elevated/70': hovered === bucket.key }"
            @mouseenter="hovered = bucket.key"
            @mouseleave="hovered = null"
          >
            <span class="flex min-w-0 items-center gap-2">
              <span class="size-3 shrink-0 rounded-sm" :style="{ background: color(bucket) }" />
              <span class="truncate">{{ bucket.label }}</span>
              <span class="text-muted">({{ bucket.count }})</span>
            </span>
            <span class="tabular-nums">{{ display(bucket) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <GroupingEditor v-model:open="editorOpen" :groupings="groupings ?? []" @saved="onSaved" />
  </UCard>
</template>
