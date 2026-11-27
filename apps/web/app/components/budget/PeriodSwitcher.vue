<script setup lang="ts">
/**
 * Budget period picker (003 US3, FR-018): arrows, "Aktueller Monat" (disabled
 * while active), a dropdown to pick a month, quarter or year of the last five
 * years, the date range of the period, and Monat/Quartal/Jahr.
 */
defineProps<{ label: string }>()
const { t } = useI18n()
const { granularity, anchor, isCurrent, previous, next, reset, setAnchor } = useBudgetPeriod()
const { settings } = useSettings()
const items = computed(() => [
  { label: t('budget.month'), value: 'month' },
  { label: t('budget.quarter'), value: 'quarter' },
  { label: t('budget.year'), value: 'year' },
])

const pad = (n: number) => String(n).padStart(2, '0')
/** First and last day of the selected period; a budget month may start on day 2–28 (014). */
const range = computed(() => {
  const year = Number(anchor.value.slice(0, 4))
  const month = Number(anchor.value.slice(5, 7)) - 1
  const start =
    granularity.value === 'month'
      ? month
      : granularity.value === 'quarter'
        ? Math.floor(month / 3) * 3
        : 0
  const span = granularity.value === 'month' ? 1 : granularity.value === 'quarter' ? 3 : 12
  const day = settings.value.budgetMonthStart
  const from = new Date(Date.UTC(year, day > 1 ? start - 1 : start, day))
  const to = new Date(Date.UTC(year, day > 1 ? start + span - 1 : start + span, day - 1))
  const short = (date: Date) => `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.`
  return t('periodPicker.range', { from: short(from), to: short(to) })
})

/** Choices for the dropdown, newest first (5 years back). */
const choices = computed(() => {
  const now = new Date()
  const thisYear = now.getUTCFullYear()
  const result: { label: string; anchor: string }[] = []
  const monthName = (m: number) =>
    new Intl.DateTimeFormat('de-DE', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2000, m, 1)),
    )
  for (let year = thisYear; year > thisYear - 5; year--) {
    if (granularity.value === 'year') {
      result.push({ label: String(year), anchor: `${year}-01-01` })
      continue
    }
    const lastMonth = year === thisYear ? now.getUTCMonth() : 11
    if (granularity.value === 'quarter') {
      for (let q = Math.floor(lastMonth / 3); q >= 0; q--) {
        result.push({ label: `Q${q + 1} ${year}`, anchor: `${year}-${pad(q * 3 + 1)}-01` })
      }
    } else {
      for (let m = lastMonth; m >= 0; m--) {
        result.push({ label: `${monthName(m)} ${year}`, anchor: `${year}-${pad(m + 1)}-01` })
      }
    }
  }
  return result
})
const pickerOpen = ref(false)
function pick(value: string): void {
  setAnchor(value)
  pickerOpen.value = false
}
const currentLabel = computed(() =>
  granularity.value === 'month' ? t('periodPicker.current') : t('budget.current'),
)
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2" data-testid="period-switcher">
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        variant="ghost"
        color="neutral"
        :aria-label="t('budget.previous')"
        data-testid="period-prev"
        @click="previous"
      />
      <UButton
        icon="i-lucide-chevron-right"
        variant="ghost"
        color="neutral"
        :disabled="isCurrent"
        :aria-label="t('budget.next')"
        data-testid="period-next"
        @click="next"
      />
      <UPopover v-model:open="pickerOpen">
        <button
          type="button"
          class="ml-1 flex items-center gap-1 rounded-md px-1 text-xl font-bold transition-colors hover:bg-elevated"
          :aria-label="t('periodPicker.pick')"
          data-testid="period-picker"
        >
          <span data-testid="period-label">{{ label }}</span>
          <UIcon name="i-lucide-chevron-down" class="size-4 text-muted" />
        </button>
        <template #content>
          <ul class="max-h-72 w-52 overflow-y-auto p-1" role="listbox" data-testid="period-options">
            <li v-for="choice in choices" :key="choice.anchor">
              <button
                type="button"
                role="option"
                class="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-elevated"
                :aria-selected="choice.anchor.slice(0, 7) === anchor.slice(0, 7)"
                @click="pick(choice.anchor)"
              >
                {{ choice.label }}
              </button>
            </li>
          </ul>
        </template>
      </UPopover>
      <span class="ml-2 hidden text-sm text-muted sm:inline" data-testid="period-range">{{
        range
      }}</span>
    </div>
    <div class="flex items-center gap-2">
      <UButton
        size="sm"
        variant="soft"
        color="neutral"
        :disabled="isCurrent"
        :label="currentLabel"
        data-testid="period-current"
        @click="reset"
      />
      <UTabs
        v-model="granularity"
        :items="items"
        :content="false"
        size="sm"
        data-testid="granularity"
      />
      <slot name="actions" />
    </div>
  </div>
</template>
