import type { LocationQuery } from 'vue-router'

/** Filter, sort and paging state of the bookings table (003 US1, research R1). */
export interface BookingQueryState {
  q: string
  review: 'all' | 'unreviewed' | 'reviewed'
  types: string[]
  categoryIds: string[]
  tagIds: string[]
  from: string
  to: string
  minCents: number | null
  maxCents: number | null
  sort: 'date' | 'amount' | 'counterparty' | 'category' | 'account'
  dir: 'asc' | 'desc'
  page: number
  pageSize: 25 | 50 | 100
}

/** Values pinned by the page (account detail, category detail, Sankey); not editable in the table. */
export type BookingFixed = Partial<{
  accounts: string
  categoryIds: string[]
  from: string
  to: string
}>

const DEFAULTS: BookingQueryState = {
  q: '',
  review: 'all',
  types: [],
  categoryIds: [],
  tagIds: [],
  from: '',
  to: '',
  minCents: null,
  maxCents: null,
  sort: 'date',
  dir: 'desc',
  page: 1,
  pageSize: 50,
}

const one = (value: LocationQuery[string]) => (Array.isArray(value) ? value[0] : value) ?? undefined
const list = (value: LocationQuery[string]) =>
  (one(value) ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
const num = (value: LocationQuery[string]) => {
  const raw = one(value)
  return raw === undefined || raw === '' || Number.isNaN(Number(raw)) ? null : Number(raw)
}

function fromRoute(query: LocationQuery): BookingQueryState {
  const review = one(query.review)
  const sort = one(query.sort)
  const pageSize = Number(one(query.pageSize))
  return {
    q: one(query.q) ?? '',
    review: review === 'unreviewed' || review === 'reviewed' ? review : 'all',
    types: list(query.types),
    categoryIds: list(query.categoryIds),
    tagIds: list(query.tagIds),
    from: one(query.from) ?? '',
    to: one(query.to) ?? '',
    minCents: num(query.minCents),
    maxCents: num(query.maxCents),
    sort: (['date', 'amount', 'counterparty', 'category', 'account'] as const).includes(
      sort as never,
    )
      ? (sort as BookingQueryState['sort'])
      : 'date',
    dir: one(query.dir) === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(one(query.page)) || 1),
    pageSize: pageSize === 25 || pageSize === 100 ? pageSize : 50,
  }
}

/** Only non-default values, as strings (query string and bulk filter). */
function toStrings(state: BookingQueryState): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(state) as [keyof BookingQueryState, unknown][]) {
    const fallback = DEFAULTS[key]
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value.join(',')
    } else if (value !== null && value !== '' && value !== fallback) {
      out[key] = String(value)
    }
  }
  return out
}

/**
 * State of one bookings table. With `routeSync` the state lives in the URL
 * (Übersicht › Transaktionen: reload- and link-safe, shared with the tiles);
 * otherwise it is local to the component. `fixed` values always win.
 */
export function useBookingQuery(options: { routeSync?: boolean; fixed?: () => BookingFixed }) {
  const route = useRoute()
  const router = useRouter()
  const { accountsParam } = useAccountFilter()
  const local = ref<BookingQueryState>({ ...DEFAULTS })

  const state = computed<BookingQueryState>(() =>
    options.routeSync ? fromRoute(route.query) : local.value,
  )

  /** Changes some fields; any filter change resets to page 1. */
  function set(patch: Partial<BookingQueryState>): void {
    const next = { ...state.value, ...patch }
    if (!('page' in patch)) next.page = 1
    if (!options.routeSync) {
      local.value = next
      return
    }
    const keep = Object.fromEntries(
      Object.entries(route.query).filter(([key]) => !(key in DEFAULTS)),
    )
    void router.replace({ query: { ...keep, ...toStrings(next) } })
  }

  function reset(): void {
    set({
      ...DEFAULTS,
      sort: state.value.sort,
      dir: state.value.dir,
      pageSize: state.value.pageSize,
    })
  }

  /** Filter for API calls (list, export, bulk), fixed values merged in. */
  const filter = computed<Record<string, string>>(() => {
    const fixed = options.fixed?.() ?? {}
    const {
      sort: _sort,
      dir: _dir,
      page: _page,
      pageSize: _size,
      ...rest
    } = toStrings({
      ...state.value,
      ...(fixed.categoryIds ? { categoryIds: fixed.categoryIds } : {}),
      ...(fixed.from ? { from: fixed.from } : {}),
      ...(fixed.to ? { to: fixed.to } : {}),
    })
    const accounts = fixed.accounts ?? accountsParam.value
    return { ...rest, ...(accounts ? { accounts } : {}) }
  })

  const listQuery = computed(() => ({
    ...filter.value,
    sort: state.value.sort,
    dir: state.value.dir,
    page: String(state.value.page),
    pageSize: String(state.value.pageSize),
  }))

  /** Number of active filters in the panel (search, sort and paging excluded). */
  const activeCount = computed(() => {
    const s = state.value
    return [
      s.review !== 'all',
      s.types.length > 0,
      s.categoryIds.length > 0,
      s.tagIds.length > 0,
      !!s.from || !!s.to,
      s.minCents !== null || s.maxCents !== null,
    ].filter(Boolean).length
  })

  return { state, set, reset, filter, listQuery, activeCount }
}
