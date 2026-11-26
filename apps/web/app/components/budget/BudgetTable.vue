<script setup lang="ts">
import type { BudgetsOverview } from '@finance/shared'

/**
 * Budgets table (003 US4, FR-022): Budgethöhe, Ausgaben, Status (progress,
 * red when over), Differenz (negative in red), Gesamtbudget row, row menu.
 */
type Row = BudgetsOverview['rows'][number]
defineProps<{ data: BudgetsOverview }>()
const emit = defineEmits<{ edit: [row: Row]; remove: [row: Row] }>()
const { t } = useI18n()
const { colorOf, iconOf } = await useCategoryAppearance()
const pct = (ratio: string) => Math.min(100, Math.round(Number(ratio) * 100))
const over = (ratio: string) => Number(ratio) > 1
const menu = (row: Row) => [
  [
    { label: t('budgetsPage.edit'), icon: 'i-lucide-pencil', onSelect: () => emit('edit', row) },
    {
      label: t('budgetsPage.delete'),
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => emit('remove', row),
    },
  ],
]
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full min-w-[560px] text-sm" data-testid="budget-table">
      <thead>
        <tr class="border-b border-default text-left text-highlighted">
          <th class="px-4 py-3 font-semibold sm:px-6">{{ t('budget.budgets.category') }}</th>
          <th class="px-3 py-3 text-right font-semibold">{{ t('budgetsPage.limit') }}</th>
          <th class="px-3 py-3 text-right font-semibold">{{ t('budgetsPage.spent') }}</th>
          <th class="w-40 px-3 py-3 font-semibold">{{ t('budgetsPage.status') }}</th>
          <th class="px-3 py-3 text-right font-semibold">{{ t('budgetsPage.diff') }}</th>
          <th class="w-10" />
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="row in data.rows" :key="row.id" class="row-hover" data-testid="budget-row">
          <td class="px-4 py-3 sm:px-6">
            <span class="flex items-center gap-2 font-medium">
              <CategoryIcon
                :icon="iconOf(row.categoryId)"
                :color="colorOf(row.categoryId)"
                size="sm"
              />
              {{ row.name }}
            </span>
          </td>
          <td class="px-3 py-3 text-right tabular-nums"><Money :cents="row.limitCents" /></td>
          <td class="px-3 py-3 text-right tabular-nums"><Money :cents="row.spentCents" /></td>
          <td class="px-3 py-3">
            <UProgress
              :model-value="pct(row.ratio)"
              size="sm"
              :color="over(row.ratio) ? 'error' : 'primary'"
              :aria-label="`${pct(row.ratio)} %`"
            />
          </td>
          <td
            class="px-3 py-3 text-right font-medium tabular-nums"
            :class="row.diffCents < 0 ? 'text-error' : ''"
            data-testid="budget-diff"
          >
            <Money :cents="row.diffCents" />
          </td>
          <td class="pr-3">
            <UDropdownMenu :items="menu(row)" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                size="xs"
                variant="ghost"
                color="neutral"
                :aria-label="t('budgetsPage.edit')"
                data-testid="budget-row-menu"
              />
            </UDropdownMenu>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="border-t border-default font-semibold" data-testid="budget-total">
          <td class="px-4 py-3 sm:px-6">{{ t('budgetsPage.totalBudget') }}</td>
          <td class="px-3 py-3 text-right tabular-nums">
            <Money :cents="data.total.limitCents" />
          </td>
          <td class="px-3 py-3 text-right tabular-nums">
            <Money :cents="data.total.spentCents" />
          </td>
          <td class="px-3 py-3">
            <UProgress
              :model-value="pct(data.total.ratio)"
              size="sm"
              :color="over(data.total.ratio) ? 'error' : 'primary'"
            />
          </td>
          <td
            class="px-3 py-3 text-right tabular-nums"
            :class="data.total.diffCents < 0 ? 'text-error' : ''"
          >
            <Money :cents="data.total.diffCents" />
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  </div>
</template>
