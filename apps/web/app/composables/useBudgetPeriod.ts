/** Shared Budget tab period (Monat / Quartal / Jahr + anchor date). */
export type Granularity = 'month' | 'quarter' | 'year'

const todayIso = () => new Date().toISOString().slice(0, 10)

function shiftAnchor(anchor: string, granularity: Granularity, steps: number): string {
  const date = new Date(`${anchor.slice(0, 7)}-01T00:00:00Z`)
  const months = granularity === 'month' ? 1 : granularity === 'quarter' ? 3 : 12
  date.setUTCMonth(date.getUTCMonth() + steps * months)
  return date.toISOString().slice(0, 10)
}

export function useBudgetPeriod() {
  const granularity = useState<Granularity>('budget-granularity', () => 'month')
  const anchor = useState<string>('budget-anchor', todayIso)
  const { accountsParam } = useAccountFilter()

  const query = computed(() => ({
    granularity: granularity.value,
    anchor: anchor.value,
    accounts: accountsParam.value,
  }))

  const isCurrent = computed(() => {
    const today = todayIso()
    const current = shiftAnchor(today, granularity.value, 0)
    return shiftAnchor(anchor.value, granularity.value, 0) === current
  })

  return {
    granularity,
    anchor,
    query,
    isCurrent,
    previous: () => (anchor.value = shiftAnchor(anchor.value, granularity.value, -1)),
    next: () => (anchor.value = shiftAnchor(anchor.value, granularity.value, 1)),
    reset: () => (anchor.value = todayIso()),
    setAnchor: (date: string) => (anchor.value = date),
  }
}
