<script setup lang="ts">
import type { ReturnsResponse } from '@finance/shared'
import { formatPct, formatPctSigned } from '~/utils/privacy'

/**
 * Wertentwicklung: IZF, inflation and real return per calendar year (US1), or
 * per trailing period ending today, "Zeiträume" (003 US5, FR-015).
 */
const props = withDefaults(
  defineProps<{ years: ReturnsResponse['years']; trailing?: ReturnsResponse['trailing'] }>(),
  { trailing: () => [] },
)
const { t } = useI18n()
const view = ref<'years' | 'periods'>('years')
const rows = computed(() =>
  view.value === 'years'
    ? [...props.years]
        .sort((a, b) => b.year - a.year)
        .map((row) => ({
          key: String(row.year),
          label: String(row.year),
          ytd: row.ytd,
          xirr: row.xirr,
          inflation: row.inflation,
          realReturn: row.realReturn,
        }))
    : props.trailing.map((row) => ({
        key: row.period,
        label: row.period === 'ALL' ? t('period.ALL') : t(`trailing.${row.period}`),
        ytd: false,
        xirr: row.xirr,
        inflation: row.inflation,
        realReturn: row.realReturn,
      })),
)
const pct = (value: string | null) => (value === null ? '–' : formatPctSigned(Number(value)))
const tone = (value: string | null) =>
  value === null ? '' : Number(value) >= 0 ? 'text-success' : 'text-error'
</script>

<template>
  <div>
    <div v-if="trailing.length > 0" class="mb-2 flex gap-4 border-b border-default" role="tablist">
      <button
        v-for="tab in [
          { value: 'years' as const, label: t('refine.years') },
          { value: 'periods' as const, label: t('refine.periods') },
        ]"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="view === tab.value"
        class="-mb-px border-b-2 pb-2 text-sm font-medium transition-colors"
        :class="
          view === tab.value
            ? 'border-(--ui-text-highlighted) text-highlighted'
            : 'border-transparent text-muted hover:text-default'
        "
        :data-testid="`returns-view-${tab.value}`"
        @click="view = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm" data-testid="yearly-table">
        <thead>
          <tr class="border-b border-default text-left text-xs text-muted">
            <th class="py-2 font-medium">
              {{ view === 'years' ? t('analysis.returns.year') : t('refine.periods') }}
            </th>
            <th class="py-2 text-right font-medium">{{ t('analysis.returns.xirr') }}</th>
            <th class="py-2 text-right font-medium">{{ t('analysis.returns.inflation') }}</th>
            <th class="py-2 text-right font-medium">{{ t('analysis.returns.real') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="row in rows"
            :key="row.key"
            :data-testid="view === 'years' ? `yearly-${row.key}` : `trailing-${row.key}`"
          >
            <td class="py-2">
              {{ row.label }}
              <UBadge v-if="row.ytd" size="sm" variant="soft" color="neutral" class="ml-1">
                {{ t('analysis.returns.ytd') }}
              </UBadge>
            </td>
            <td class="py-2 text-right tabular-nums" :class="tone(row.xirr)">
              {{ pct(row.xirr) }}
            </td>
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
  </div>
</template>
