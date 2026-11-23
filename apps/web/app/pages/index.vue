<script setup lang="ts">
import type { WidgetKey, WidgetLayoutItem } from '@finance/shared'
import AccountsCard from '~/components/dashboard/AccountsCard.vue'
import AllocationCard from '~/components/dashboard/AllocationCard.vue'
import BudgetsCard from '~/components/dashboard/BudgetsCard.vue'
import CashflowCard from '~/components/dashboard/CashflowCard.vue'
import HoldingsCard from '~/components/dashboard/HoldingsCard.vue'
import KpiCard from '~/components/dashboard/KpiCard.vue'
import NetWorthChart from '~/components/dashboard/NetWorthChart.vue'
import ReviewBanner from '~/components/dashboard/ReviewBanner.vue'

const { t } = useI18n()
useHead({ title: t('nav.overview') })

const WIDGETS: Record<WidgetKey, Component> = {
  networth: NetWorthChart,
  allocation: AllocationCard,
  kpis: KpiCard,
  holdings: HoldingsCard,
  accounts: AccountsCard,
  review: ReviewBanner,
  cashflow: CashflowCard,
  budgets: BudgetsCard,
}
/** Widgets that span both columns on wide screens. */
const WIDE = new Set<WidgetKey>(['networth', 'review'])

const { data: layout, refresh } = await useApi<WidgetLayoutItem[]>('/api/dashboard/layout', {
  default: () => [],
})
const visible = computed(() =>
  [...(layout.value ?? [])].sort((a, b) => a.position - b.position).filter((item) => item.visible),
)

/** Consecutive runs of wide widgets and of column widgets, in layout order. */
const segments = computed(() => {
  const result: { key: string; wide: boolean; start: number; items: WidgetLayoutItem[] }[] = []
  visible.value.forEach((item, index) => {
    const wide = WIDE.has(item.widgetKey)
    const last = result.at(-1)
    if (!wide && last && !last.wide) last.items.push(item)
    else result.push({ key: item.widgetKey, wide, start: index, items: [item] })
  })
  return result
})

const customizing = ref(false)
const toast = useToast()

async function saveLayout(next: WidgetLayoutItem[]): Promise<void> {
  layout.value = next
  try {
    await apiFetch('/api/dashboard/layout', { method: 'PUT', body: next })
  } catch {
    toast.add({ title: t('overview.customize.error'), color: 'error' })
  }
  await refresh()
}
</script>

<template>
  <section>
    <div class="mb-4 flex items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">{{ t('nav.overview') }}</h1>
      <UButton
        icon="i-lucide-layout-dashboard"
        variant="soft"
        color="neutral"
        :label="t('overview.customize.button')"
        data-testid="customize-open"
        @click="customizing = true"
      />
    </div>

    <!--
      Like the reference: wide widgets span the page, the others flow into two
      independent columns (masonry) so short cards do not leave gaps.
    -->
    <div class="space-y-3" data-testid="dashboard">
      <template v-for="segment in segments" :key="segment.key">
        <component
          :is="WIDGETS[segment.items[0]!.widgetKey]"
          v-if="segment.wide"
          class="reveal card-hover"
          :style="{ '--i': segment.start }"
        />
        <div v-else class="gap-3 md:columns-2">
          <component
            :is="WIDGETS[item.widgetKey]"
            v-for="(item, offset) in segment.items"
            :key="item.widgetKey"
            class="reveal card-hover mb-3 break-inside-avoid"
            :style="{ '--i': segment.start + offset }"
          />
        </div>
      </template>
    </div>

    <CustomizeModal v-model:open="customizing" :layout="layout ?? []" @save="saveLayout" />
  </section>
</template>
