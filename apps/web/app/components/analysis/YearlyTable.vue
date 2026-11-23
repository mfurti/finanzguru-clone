<script setup lang="ts">
import { formatPct, formatPctSigned, type ReturnsResponse } from '@finance/shared'

/** Wertentwicklung per year: IZF, inflation and real return (US1). */
const props = defineProps<{ years: ReturnsResponse['years'] }>()
const { t } = useI18n()
const rows = computed(() => [...props.years].sort((a, b) => b.year - a.year))
const pct = (value: string | null) => (value === null ? '–' : formatPctSigned(Number(value)))
const tone = (value: string | null) =>
  value === null ? '' : Number(value) >= 0 ? 'text-success' : 'text-error'
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm" data-testid="yearly-table">
      <thead>
        <tr class="border-b border-default text-left text-xs text-muted">
          <th class="py-2 font-medium">{{ t('analysis.returns.year') }}</th>
          <th class="py-2 text-right font-medium">{{ t('analysis.returns.xirr') }}</th>
          <th class="py-2 text-right font-medium">{{ t('analysis.returns.inflation') }}</th>
          <th class="py-2 text-right font-medium">{{ t('analysis.returns.real') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="row in rows" :key="row.year" :data-testid="`yearly-${row.year}`">
          <td class="py-2">
            {{ row.year }}
            <UBadge v-if="row.ytd" size="sm" variant="soft" color="neutral" class="ml-1">
              {{ t('analysis.returns.ytd') }}
            </UBadge>
          </td>
          <td class="py-2 text-right tabular-nums" :class="tone(row.xirr)">{{ pct(row.xirr) }}</td>
          <td class="py-2 text-right tabular-nums text-muted">
            {{ formatPct(Number(row.inflation)) }}
          </td>
          <td class="py-2 text-right tabular-nums" :class="tone(row.realReturn)">
            {{ pct(row.realReturn) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
