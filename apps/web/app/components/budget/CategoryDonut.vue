<script setup lang="ts">
import type { CashflowCategories } from '@finance/shared'

/**
 * Category pie chart next to the category list (US7), in the one donut look of the app
 * (dashboard Aufteilung, 011). Like the reference: the
 * ring sweeps in, a hovered slice (or hovered list row) lights up with a halo
 * and the center shows that category's amount and name; clicking a slice
 * selects the category like the list does.
 */
type Item = CashflowCategories['items'][number]
const props = defineProps<{
  items: Item[]
  totalCents: number
  sign: number
  colors: (item: Item, index: number) => string
  /** "expense" → "Gesamtausgaben", "income" → "Gesamteinnahmen" in the centre (007 R6). */
  kind?: 'expense' | 'income'
}>()
const hovered = defineModel<string | null>('hovered', { default: null })
const emit = defineEmits<{ select: [categoryId: string] }>()
const { t } = useI18n()

const donutItems = computed(() =>
  props.items.map((item, index) => ({
    key: item.categoryId,
    value: item.totalCents,
    color: props.colors(item, index),
    label: item.name,
  })),
)
</script>

<template>
  <div class="mx-auto flex w-full justify-center" data-testid="category-donut">
    <EmptyState v-if="items.length === 0" :title="t('budget.noData')" icon="i-lucide-chart-pie" />
    <DonutChart
      v-else
      v-model:hovered="hovered"
      :items="donutItems"
      :max-size="400"
      @select="(key) => emit('select', key)"
    >
      <template #center="{ item }">
        <span class="font-semibold">
          <Money v-if="item" :cents="sign * item.value" />
          <Money v-else :cents="sign * totalCents" animate />
        </span>
        <span class="line-clamp-2 text-xs text-muted" data-testid="donut-center-label">
          {{
            item
              ? item.label
              : kind === 'income'
                ? t('charts.totalIncome')
                : kind === 'expense'
                  ? t('charts.totalExpenses')
                  : t('budget.chart.total')
          }}
        </span>
      </template>
    </DonutChart>
  </div>
</template>
