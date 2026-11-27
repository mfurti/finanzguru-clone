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

definePageMeta({ layout: 'overview' })

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
/**
 * Fixed columns like the reference (007 R5): left Aufteilung, Kennzahlen, Holdings; right
 * Portfolios & Konten, Ungeprüfte, Einnahmen & Ausgaben, Budgets; the chart on top.
 */
const LEFT = new Set<WidgetKey>(['allocation', 'kpis', 'holdings'])

const { data: layout, refresh } = await useApi<WidgetLayoutItem[]>('/api/dashboard/layout', {
  default: () => [],
})
const visible = computed(() =>
  [...(layout.value ?? [])].sort((a, b) => a.position - b.position).filter((item) => item.visible),
)
const top = computed(() => visible.value.filter((item) => item.widgetKey === 'networth'))
const left = computed(() => visible.value.filter((item) => LEFT.has(item.widgetKey)))
const right = computed(() =>
  visible.value.filter((item) => item.widgetKey !== 'networth' && !LEFT.has(item.widgetKey)),
)
/** Position in the layout: animation delay and the order when stacked below 1024 px. */
const rank = (item: WidgetLayoutItem) => visible.value.indexOf(item)

const customizing = useDashboardCustomizing()
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
    <h1 class="sr-only">{{ t('nav.overview') }}</h1>

    <!--
    Below 1024 px the columns dissolve (display: contents) and every card is ordered by its
    layout position; from 1024 px two fixed columns like the reference.
  -->
    <div class="space-y-3" data-testid="dashboard">
      <component
        :is="WIDGETS[item.widgetKey]"
        v-for="item in top"
        :key="item.widgetKey"
        class="reveal"
        :style="{ '--i': rank(item) }"
      />
      <div class="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        <div
          v-for="column in [left, right]"
          :key="column === left ? 'left' : 'right'"
          class="contents lg:flex lg:flex-col lg:gap-3"
          :data-testid="column === left ? 'dashboard-left' : 'dashboard-right'"
        >
          <component
            :is="WIDGETS[item.widgetKey]"
            v-for="item in column"
            :key="item.widgetKey"
            class="reveal"
            :style="{ '--i': rank(item), order: rank(item) }"
          />
        </div>
      </div>
    </div>

    <CustomizeModal v-model:open="customizing" :layout="layout ?? []" @save="saveLayout" />
  </section>
</template>
