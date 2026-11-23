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

    <div class="grid gap-4 lg:grid-cols-2">
      <component
        :is="WIDGETS[item.widgetKey]"
        v-for="item in visible"
        :key="item.widgetKey"
        :class="{ 'lg:col-span-2': WIDE.has(item.widgetKey) }"
      />
    </div>

    <CustomizeModal v-model:open="customizing" :layout="layout ?? []" @save="saveLayout" />
  </section>
</template>
