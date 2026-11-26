<script setup lang="ts">
import {
  formatDate,
  formatEur,
  type GainSplit,
  type Period,
  type PositionDto,
} from '@finance/shared'
import { VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue'

const { t } = useI18n()
const route = useRoute()
const { accountsParam } = useAccountFilter()
const period = ref<Period>('1Y')

interface Detail {
  instrument: { id: string; name: string; isin: string; wkn: string | null; assetClass: string }
  position: PositionDto | null
  series: { date: string; close: string }[]
  transactions: {
    id: string
    bookingDate: string
    type: string
    amountCents: number
    quantity: string | null
  }[]
  /** GuV = Realisiert + Kursgewinn (005 US3). */
  gain: GainSplit
}

const { data, error } = await useApi<Detail>(
  () => `/api/investments/instruments/${route.params.instrumentId}`,
  {
    query: { period, accounts: accountsParam },
  },
)
useHead({ title: () => data.value?.instrument.name ?? t('nav.investments') })

type Point = { index: number; date: string; close: number }
const points = computed<Point[]>(() =>
  (data.value?.series ?? []).map((point, index) => ({
    index,
    date: point.date,
    close: Number(point.close),
  })),
)
const x = (point: Point) => point.index
const y = (point: Point) => point.close
const tooltip = (point: Point) =>
  `<div class="text-xs">${formatDate(point.date)}: ${formatEur(Math.round(point.close * 100))}</div>`
</script>

<template>
  <section class="space-y-4">
    <UButton
      to="/investments"
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
      :label="t('nav.investments')"
    />
    <EmptyState v-if="error || !data" :title="t('investments.empty')" icon="i-lucide-search-x" />
    <template v-else>
      <div>
        <h1 class="text-xl font-semibold" data-testid="instrument-name">
          {{ data.instrument.name }}
        </h1>
        <p class="text-sm text-muted">
          {{ t(`assetClasses.${data.instrument.assetClass}`) }} · {{ data.instrument.wkn }} ·
          {{ data.instrument.isin }}
        </p>
      </div>

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t('investments.detail.price') }}</h2>
        </template>
        <PeriodTabs v-model="period" class="mb-3" />
        <ClientOnly>
          <VisXYContainer v-if="points.length > 0" :data="points" :height="220" class="chart">
            <VisLine :x="x" :y="y" color="var(--color-emerald-500)" :line-width="2" />
            <VisAxis
              type="x"
              :tick-format="
                (i: number) =>
                  points[Math.round(i)] ? formatDate(points[Math.round(i)]!.date) : ''
              "
              :num-ticks="3"
              :grid-line="false"
            />
            <VisAxis type="y" :num-ticks="4" />
            <VisCrosshair :template="tooltip" />
            <VisTooltip />
          </VisXYContainer>
        </ClientOnly>
      </UCard>

      <UCard data-testid="instrument-position">
        <template #header>
          <h2 class="font-semibold">{{ t('investments.detail.position') }}</h2>
        </template>
        <p v-if="!data.position" class="text-sm text-muted">
          {{ t('investments.detail.noPosition') }}
        </p>
        <dl v-else class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt class="text-muted">{{ t('investments.columns.value') }}</dt>
            <dd class="font-medium"><Money :cents="data.position.valueCents" /></dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('investments.columns.entryValue') }}</dt>
            <dd class="font-medium"><Money :cents="data.position.entryValueCents" /></dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('investments.gainSplit.total') }}</dt>
            <dd class="font-medium" data-testid="gain-total">
              <Money :cents="data.gain.totalGainCents" signed />
            </dd>
            <dd class="mt-1 space-y-0.5 text-xs text-muted">
              <span class="flex justify-between gap-2">
                {{ t('investments.gainSplit.realized') }}
                <Money :cents="data.gain.realizedCents" signed data-testid="gain-realized" />
              </span>
              <span class="flex justify-between gap-2">
                {{ t('investments.gainSplit.priceGain') }}
                <Money :cents="data.gain.priceGainCents" signed data-testid="gain-price" />
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">{{ t('investments.tx.quantity') }}</dt>
            <dd class="font-medium">
              {{ Number(data.position.quantity).toLocaleString('de-DE') }}
            </dd>
          </div>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">{{ t('investments.detail.transactions') }}</h2>
        </template>
        <ul class="divide-y divide-default text-sm">
          <li
            v-for="row in data.transactions"
            :key="row.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <span>
              {{ formatDate(row.bookingDate) }} · {{ t(`transactionTypes.${row.type}`) }}
              <span v-if="row.quantity" class="text-muted"
                >· {{ Number(row.quantity).toLocaleString('de-DE') }}
                {{ t('investments.pieces') }}</span
              >
            </span>
            <Money :cents="row.amountCents" signed />
          </li>
        </ul>
      </UCard>
      <ClassificationForm
        :instrument-id="data.instrument.id"
        :is-fund="data.instrument.assetClass === 'etf' || data.instrument.assetClass === 'fund'"
      />
    </template>
  </section>
</template>

<style scoped>
.chart {
  --vis-axis-tick-label-color: var(--ui-text-muted);
  --vis-axis-grid-color: var(--ui-border);
  --vis-tooltip-background-color: var(--ui-bg-elevated);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text);
}
</style>
