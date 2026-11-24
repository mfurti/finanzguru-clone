<script setup lang="ts">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'
import {
  formatDate,
  formatEur,
  formatEurCompact,
  type AccountDetail,
  type Period,
} from '@finance/shared'

/**
 * Detail page of one account or depot (003 US2, FR-009): header, balance
 * history with period tabs, key figures, then the page's own content
 * (bookings; depots add positions) in the default slot.
 */
const props = defineProps<{ id: string }>()
const { t } = useI18n()
const period = ref<Period>('1Y')
const { data, error } = await useApi<AccountDetail>(() => `/api/accounts/${props.id}/detail`, {
  query: { period },
})
useHead({ title: computed(() => data.value?.account.name ?? t('accountsOverview.notFound')) })

type Point = { date: string; valueCents: number; index: number }
const points = computed<Point[]>(() =>
  (data.value?.history ?? []).map((point, index) => ({ ...point, index })),
)
const x = (point: Point) => point.index
const y = (point: Point) => point.valueCents / 100
const tickDate = (index: number) => {
  const point = points.value[Math.round(index)]
  if (!point) return ''
  return new Intl.DateTimeFormat('de-DE', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${point.date}T00:00:00Z`))
}
const tooltip = (point: Point) =>
  `<div class="text-xs"><div>${formatDate(point.date)}</div><b>${formatEur(point.valueCents)}</b></div>`
const figures = computed(() =>
  data.value
    ? [
        { key: 'balance', cents: data.value.figures.balanceCents, signed: false },
        { key: 'change', cents: data.value.figures.changeCents, signed: true },
        { key: 'inflow', cents: data.value.figures.inflowCents, signed: true },
        { key: 'outflow', cents: data.value.figures.outflowCents, signed: true },
      ]
    : [],
)
</script>

<template>
  <OverviewSection>
    <EmptyState
      v-if="error || !data"
      :title="t('accountsOverview.notFound')"
      icon="i-lucide-wallet"
      :action-label="t('overview.views.accounts')"
      action-to="/accounts"
    />
    <section v-else class="space-y-4" data-testid="account-detail">
      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          to="/accounts"
          :aria-label="t('overview.views.accounts')"
        />
        <Avatar
          :name="
            data.account.institution === 'Manuell' ? data.account.name : data.account.institution
          "
          size="lg"
        />
        <div class="min-w-0">
          <h1 class="truncate text-xl font-bold">{{ data.account.name }}</h1>
          <p class="flex items-center gap-1 text-sm text-muted">
            {{ data.account.institution }}
            <template v-if="data.account.ibanMasked">
              · <span class="font-mono">{{ data.account.ibanMasked }}</span>
              <CopyButton :value="data.account.iban!" :label="t('accountsOverview.copyIban')" />
            </template>
          </p>
        </div>
        <Money :cents="data.account.balanceCents" class="ml-auto text-2xl font-bold" />
      </div>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2>{{ t('accountsOverview.history') }}</h2>
            <PeriodTabs v-model="period" />
          </div>
        </template>
        <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="account-figures">
          <div v-for="figure in figures" :key="figure.key">
            <div class="text-xs text-muted">{{ t(`accountsOverview.figures.${figure.key}`) }}</div>
            <Money :cents="figure.cents" :signed="figure.signed" class="text-lg font-semibold" />
          </div>
        </div>
        <ClientOnly>
          <VisXYContainer :data="points" :height="220" class="account-chart">
            <VisArea :x="x" :y="y" color="var(--ui-primary)" :opacity="0.15" />
            <VisLine :x="x" :y="y" color="var(--ui-primary)" :line-width="2" />
            <VisAxis type="x" :tick-format="tickDate" :num-ticks="4" :grid-line="false" />
            <VisAxis
              type="y"
              :tick-format="(value: number) => formatEurCompact(Math.round(value * 100))"
              :num-ticks="4"
            />
            <VisCrosshair :template="tooltip" color="var(--ui-primary)" />
            <VisTooltip />
          </VisXYContainer>
          <template #fallback><USkeleton class="h-[220px] w-full" /></template>
        </ClientOnly>
      </UCard>

      <slot :account="data.account" />
    </section>
  </OverviewSection>
</template>

<style scoped>
.account-chart {
  --vis-axis-tick-label-color: var(--ui-text-muted);
  --vis-axis-grid-color: var(--ui-border);
  --vis-tooltip-background-color: var(--ui-bg-elevated);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text);
}
</style>
