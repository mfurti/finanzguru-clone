<script setup lang="ts">
import type { ReturnsResponse } from '@finance/shared'
import { formatPctSigned } from '~/utils/privacy'

/** Monthly TWROR as a months × years grid with a diverging color scale (US1). */
const props = defineProps<{
  months: ReturnsResponse['months']
  years: ReturnsResponse['years']
}>()
const { t } = useI18n()

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, i, 1)),
  ),
)

const rows = computed(() =>
  [...props.years]
    .sort((a, b) => b.year - a.year)
    .map((year) => ({
      year: year.year,
      total: year.twror,
      months: Array.from({ length: 12 }, (_, i) => {
        return props.months.find((m) => m.year === year.year && m.month === i + 1)?.twror ?? null
      }),
    })),
)

/** Saturates at ±5 % per month (±25 % for the year column). */
function cellStyle(value: string | null, scale = 0.05): Record<string, string> {
  if (value === null) return {}
  const ratio = Math.min(Math.abs(Number(value)) / scale, 1)
  const color = Number(value) >= 0 ? 'var(--color-emerald-500)' : 'var(--color-rose-500)'
  return {
    background: `color-mix(in oklab, ${color} ${Math.round(10 + ratio * 55)}%, transparent)`,
  }
}
const label = (value: string | null) => (value === null ? '–' : formatPctSigned(Number(value)))
</script>

<template>
  <div class="overflow-x-auto" data-testid="return-heatmap">
    <table class="w-full min-w-[720px] border-separate border-spacing-0.5 text-center text-xs">
      <thead>
        <tr class="text-muted">
          <th class="px-1 py-1 text-left font-medium">{{ t('analysis.returns.year') }}</th>
          <th v-for="month in MONTHS" :key="month" class="px-1 py-1 font-medium">{{ month }}</th>
          <th class="px-1 py-1 font-medium">{{ t('analysis.returns.total') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.year">
          <th class="px-1 py-1.5 text-left font-medium">{{ row.year }}</th>
          <td
            v-for="(value, index) in row.months"
            :key="index"
            class="rounded px-1 py-1.5 tabular-nums"
            :style="cellStyle(value)"
          >
            {{ label(value) }}
          </td>
          <td
            class="rounded px-1 py-1.5 font-semibold tabular-nums"
            :style="cellStyle(row.total, 0.25)"
            :data-testid="`heatmap-total-${row.year}`"
          >
            {{ label(row.total) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
