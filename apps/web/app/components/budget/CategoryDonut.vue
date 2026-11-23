<script setup lang="ts">
import type { CashflowCategories } from '@finance/shared'
import { Donut } from '@unovis/ts'
import { VisDonut, VisSingleContainer } from '@unovis/vue'

/**
 * Category pie chart next to the category list (US7). Hovering a slice reports
 * its category (the list highlights the row) and a hovered row dims the other
 * slices; clicking a slice selects the category like the list does.
 */
type Item = CashflowCategories['items'][number]
const props = defineProps<{
  items: Item[]
  totalCents: number
  sign: number
  colors: (item: Item, index: number) => string
}>()
const hovered = defineModel<string | null>('hovered', { default: null })
const emit = defineEmits<{ select: [categoryId: string] }>()
const { t } = useI18n()

const value = (item: Item) => item.totalCents
/** New function per hover state so Unovis re-renders the slices. */
const color = computed(() => {
  const active = hovered.value
  return (item: Item, index: number) => {
    const base = props.colors(item, index)
    return active && active !== item.categoryId
      ? `color-mix(in oklab, ${base} 35%, transparent)`
      : base
  }
})
type Arc = { data: Item }
const events = {
  [Donut.selectors.segment]: {
    mouseover: (arc: Arc) => (hovered.value = arc.data.categoryId),
    mouseleave: () => (hovered.value = null),
    click: (arc: Arc) => emit('select', arc.data.categoryId),
  },
}
</script>

<template>
  <div class="relative mx-auto size-44 shrink-0" data-testid="category-donut">
    <EmptyState v-if="items.length === 0" :title="t('budget.noData')" icon="i-lucide-chart-pie" />
    <template v-else>
      <ClientOnly>
        <VisSingleContainer :data="items" :height="176">
          <VisDonut
            :value="value"
            :color="color"
            :arc-width="20"
            :pad-angle="0.01"
            :events="events"
          />
        </VisSingleContainer>
      </ClientOnly>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
      >
        <span class="font-semibold"><Money :cents="sign * totalCents" animate /></span>
        <span class="text-xs text-muted">{{ t('budget.chart.total') }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
:deep(path[class$='-segment']) {
  cursor: pointer;
}
</style>
