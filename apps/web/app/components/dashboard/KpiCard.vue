<script setup lang="ts">
import type { KpiResponse, Period } from '@finance/shared'

/** "Kennzahlen" for a period (US1 scenario 6). */
const { t, te } = useI18n()
const { accountsParam } = useAccountFilter()
const period = ref<Period>('1Y')

const periodItems = computed(() =>
  (['1M', 'YTD', '1Y', '3Y', '5Y', 'ALL'] as const).map((value) => ({
    value,
    label: t(`periodLong.${value}`),
  })),
)

const { data } = await useApi<KpiResponse>('/api/overview/kpis', {
  query: { period, accounts: accountsParam },
})

interface Row {
  key: string
  cents?: number | null
  pct?: string | null
  net?: number | null
  signed?: boolean
  bold?: boolean
}

const rows = computed<Row[]>(() => {
  const k = data.value
  if (!k) return []
  return [
    { key: 'invested', cents: k.investedCents },
    { key: 'priceGain', cents: k.priceGain.cents, pct: k.priceGain.pct, signed: true },
    {
      key: 'realized',
      cents: k.realized.grossCents,
      pct: k.realized.pct,
      net: k.realized.netCents,
      signed: true,
    },
    { key: 'otherGains', cents: k.otherGainsCents || null, signed: true },
    {
      key: 'dividends',
      cents: k.dividends.grossCents || null,
      net: k.dividends.netCents || null,
      signed: true,
    },
    {
      key: 'interest',
      cents: k.interest.grossCents || null,
      net: k.interest.netCents || null,
      signed: true,
    },
    { key: 'taxesFees', cents: k.taxesFeesCents, signed: true },
    { key: 'totalReturn', cents: k.totalReturnCents, signed: true, bold: true },
  ]
})
</script>

<template>
  <UCard data-testid="kpi-card">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('overview.kpis.title') }}</h2>
        <USelect v-model="period" :items="periodItems" size="sm" class="w-32" />
      </div>
    </template>

    <EmptyState v-if="!data" :title="t('overview.empty.title')" icon="i-lucide-calculator" />
    <div v-else class="text-sm">
      <dl class="divide-y divide-default">
        <div
          v-for="row in rows"
          :key="row.key"
          class="row-hover flex items-center justify-between gap-3 py-2"
          :class="{ 'font-semibold': row.bold }"
        >
          <dt class="flex items-center gap-1">
            {{ t(`overview.kpis.${row.key}`) }}
            <InfoTooltip
              v-if="te(`overview.kpis.info.${row.key}`)"
              :text="t(`overview.kpis.info.${row.key}`)"
            />
          </dt>
          <dd class="flex flex-wrap items-center justify-end gap-2">
            <UBadge
              v-if="row.pct && row.cents"
              variant="subtle"
              :color="Number(row.pct) < 0 ? 'error' : 'success'"
            >
              <Percent :value="row.pct" signed :colored="false" />
            </UBadge>
            <span v-if="row.net !== undefined && row.net !== null" class="text-muted">
              {{ t('overview.kpis.net') }} <Money :cents="row.net" signed :colored="false" />
            </span>
            <Money :cents="row.cents" :signed="row.signed" animate />
          </dd>
        </div>
      </dl>
      <USeparator class="my-2" />
      <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
        <div v-for="rate in ['twror', 'irr', 'inflation', 'realReturn'] as const" :key="rate">
          <dt class="flex items-center gap-1 text-muted">
            {{ t(`overview.kpis.${rate}`) }}
            <InfoTooltip :text="t(`overview.kpis.info.${rate}`)" />
          </dt>
          <dd class="font-medium">
            <Percent :value="data[rate]" :signed="rate !== 'inflation'" />
          </dd>
        </div>
      </dl>
    </div>
  </UCard>
</template>
