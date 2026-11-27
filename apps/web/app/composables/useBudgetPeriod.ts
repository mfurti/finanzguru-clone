/** Shared Budget tab period (Monat / Quartal / Jahr + anchor date). */
export type Granularity = 'month' | 'quarter' | 'year'

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * First day of the budget month a date belongs to (014): with a start day above 1, a date on
 * or after it belongs to the next month (start 25: 26.11. is in "Dezember").
 */
export function budgetMonthOf(date: string, startDay: number): string {
  const month = new Date(`${date.slice(0, 7)}-01T00:00:00Z`)
  if (startDay > 1 && Number(date.slice(8, 10)) >= startDay)
    month.setUTCMonth(month.getUTCMonth() + 1)
  return month.toISOString().slice(0, 10)
}

function shiftAnchor(
  anchor: string,
  granularity: Granularity,
  steps: number,
  startDay: number,
): string {
  const date = new Date(`${budgetMonthOf(anchor, startDay)}T00:00:00Z`)
  const months = granularity === 'month' ? 1 : granularity === 'quarter' ? 3 : 12
  date.setUTCMonth(date.getUTCMonth() + steps * months)
  return date.toISOString().slice(0, 10)
}

export function useBudgetPeriod() {
  const granularity = useState<Granularity>('budget-granularity', () => 'month')
  const { accountsParam } = useAccountFilter()
  const { settings } = useSettings()
  const startDay = () => settings.value.budgetMonthStart
  // Always the first day of a budget month, so "YYYY-MM" of the anchor names that month.
  const anchor = useState<string>('budget-anchor', () => budgetMonthOf(todayIso(), startDay()))

  const query = computed(() => ({
    granularity: granularity.value,
    anchor: anchor.value,
    accounts: accountsParam.value,
  }))

  const isCurrent = computed(() => {
    const today = todayIso()
    const current = shiftAnchor(today, granularity.value, 0, startDay())
    return shiftAnchor(anchor.value, granularity.value, 0, startDay()) === current
  })

  return {
    granularity,
    anchor,
    query,
    isCurrent,
    previous: () => (anchor.value = shiftAnchor(anchor.value, granularity.value, -1, startDay())),
    next: () => (anchor.value = shiftAnchor(anchor.value, granularity.value, 1, startDay())),
    reset: () => (anchor.value = budgetMonthOf(todayIso(), startDay())),
    setAnchor: (date: string) => (anchor.value = budgetMonthOf(date, startDay())),
  }
}
