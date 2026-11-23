/**
 * Global account filter (FR-002). The selection lives in the `?accounts=` query
 * parameter so it survives reloads and can be shared; empty = all accounts.
 */
export function useAccountFilter() {
  const route = useRoute()
  const router = useRouter()

  const selected = computed<string[]>(() => {
    const raw = route.query.accounts
    const value = Array.isArray(raw) ? raw[0] : raw
    return value
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : []
  })

  /** Query string value for API calls; undefined means all accounts. */
  const accountsParam = computed(() =>
    selected.value.length > 0 ? selected.value.join(',') : undefined,
  )

  function setSelected(ids: readonly string[]): void {
    const query = { ...route.query }
    if (ids.length > 0) query.accounts = [...ids].sort().join(',')
    else delete query.accounts
    void router.replace({ query })
  }

  function toggle(id: string): void {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected([...next])
  }

  const isAll = computed(() => selected.value.length === 0)

  return { selected, accountsParam, isAll, setSelected, toggle, reset: () => setSelected([]) }
}
