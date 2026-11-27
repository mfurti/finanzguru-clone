import { Inject, Injectable } from '@nestjs/common'
import type { NetWorthQuery, NetWorthResponse, Period } from '@finance/shared'
import { and, asc, eq, gte, inArray, isNull, lt, lte, min, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, netWorthSnapshot } from '../../database/schema'
import { ratio } from '../../domain/money'
import { eachDay, type DateRange, resolveRange, todayIso } from '../../domain/period'
import { SettingsService } from '../settings/settings.service'

/** Max points per chart series (research R13). */
export const MAX_POINTS = 400

export interface AccountRef {
  id: string
  type: string
}

export interface DailyTotals {
  date: string
  valueCents: number
  investedCents: number
  cashCents: number
  depotValueCents: number
  depotFlowCents: number
  flowCents: number
}

/** Keeps every n-th point so a series has at most `max` points; the last point always stays. */
export function downsample<T>(points: readonly T[], max = MAX_POINTS): T[] {
  if (points.length <= max) return [...points]
  const step = Math.ceil(points.length / max)
  const result = points.filter((_, index) => index % step === 0)
  if (result.at(-1) !== points.at(-1)) result.push(points.at(-1)!)
  return result
}

@Injectable()
export class OverviewService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Selected accounts, or all visible accounts when the filter is empty. Archived accounts
   * (014) count only when the owner keeps them in the sums.
   */
  resolveAccounts(ids?: readonly string[]): AccountRef[] {
    const query = this.db.select({ id: account.id, type: account.type }).from(account)
    return ids && ids.length > 0
      ? query.where(inArray(account.id, [...ids])).all()
      : query
          .where(
            this.settings.get().archivedInSums
              ? eq(account.isHidden, false)
              : and(eq(account.isHidden, false), isNull(account.archivedAt)),
          )
          .all()
  }

  firstSnapshotDate(accountIds: readonly string[]): string | undefined {
    if (accountIds.length === 0) return undefined
    return (
      this.db
        .select({ first: min(netWorthSnapshot.date) })
        .from(netWorthSnapshot)
        .where(inArray(netWorthSnapshot.accountId, [...accountIds]))
        .get()?.first ?? undefined
    )
  }

  range(
    accounts: readonly AccountRef[],
    query: { period: Period; from?: string; to?: string },
    today = todayIso(),
  ): DateRange {
    const first = this.firstSnapshotDate(accounts.map((acc) => acc.id))
    return resolveRange(query, today, first)
  }

  /**
   * Daily totals over the selected accounts. Missing days carry the account's
   * last known snapshot forward (e.g. accounts without bookings).
   */
  dailyTotals(accounts: readonly AccountRef[], range: DateRange): DailyTotals[] {
    if (accounts.length === 0) return []
    const ids = accounts.map((acc) => acc.id)
    const isDepot = new Map(accounts.map((acc) => [acc.id, acc.type === 'depot']))

    // Opening value per account: its latest snapshot before the range.
    const opening = this.db
      .select()
      .from(netWorthSnapshot)
      .where(
        and(
          inArray(netWorthSnapshot.accountId, ids),
          lt(netWorthSnapshot.date, range.from),
          eq(
            netWorthSnapshot.date,
            sql`(SELECT max(x.date) FROM net_worth_snapshot x WHERE x.account_id = ${netWorthSnapshot.accountId} AND x.date < ${range.from})`,
          ),
        ),
      )
      .all()
    const rows = this.db
      .select()
      .from(netWorthSnapshot)
      .where(
        and(
          inArray(netWorthSnapshot.accountId, ids),
          gte(netWorthSnapshot.date, range.from),
          lte(netWorthSnapshot.date, range.to),
        ),
      )
      .orderBy(asc(netWorthSnapshot.date))
      .all()

    const current = new Map<string, { value: number; invested: number }>()
    for (const row of opening)
      current.set(row.accountId, { value: row.valueCents, invested: row.investedCents })

    const result: DailyTotals[] = []
    let index = 0
    for (const day of eachDay(range.from, range.to)) {
      let flow = 0
      let depotFlow = 0
      while (index < rows.length && rows[index]!.date === day) {
        const row = rows[index++]!
        current.set(row.accountId, { value: row.valueCents, invested: row.investedCents })
        flow += row.externalFlowCents
        if (isDepot.get(row.accountId)) depotFlow += row.externalFlowCents
      }
      let value = 0
      let invested = 0
      let cash = 0
      let depotValue = 0
      for (const [accountId, snapshot] of current) {
        value += snapshot.value
        invested += snapshot.invested
        if (isDepot.get(accountId)) depotValue += snapshot.value
        else cash += snapshot.value
      }
      result.push({
        date: day,
        valueCents: value,
        investedCents: invested,
        cashCents: cash,
        depotValueCents: depotValue,
        depotFlowCents: depotFlow,
        flowCents: flow,
      })
    }
    return result
  }

  netWorth(query: NetWorthQuery, today = todayIso()): NetWorthResponse {
    const accounts = this.resolveAccounts(query.accounts)
    const range = this.range(accounts, query, today)
    const totals = this.dailyTotals(accounts, range)
    if (totals.length === 0) return { totalCents: 0, gainCents: 0, gainPct: null, series: [] }

    // Cumulative investment return (depot part) for the "Rendite" view, chained
    // incrementally: factor *= V_t / (V_{t-1} + F_t) (same convention as twror()).
    let factor = 1
    let invested = false
    const cumulative: (string | null)[] = totals.map((point, index) => {
      if (index > 0) {
        const base = totals[index - 1]!.depotValueCents + point.depotFlowCents
        if (base > 0) {
          factor *= point.depotValueCents / base
          invested = true
        }
      }
      return invested ? (factor - 1).toFixed(6) : index === 0 ? '0' : null
    })

    const first = totals[0]!
    const last = totals.at(-1)!
    const flowsAfterStart = totals.slice(1).reduce((sum, point) => sum + point.flowCents, 0)
    const gainCents = last.valueCents - first.valueCents - flowsAfterStart

    const series = totals.map((point, index) => ({
      date: point.date,
      valueCents: point.valueCents,
      investedCents: point.investedCents,
      cashCents: point.cashCents,
      returnPct: cumulative[index] ?? null,
    }))

    return {
      totalCents: last.valueCents,
      gainCents,
      gainPct: ratio(gainCents, first.valueCents + Math.max(flowsAfterStart, 0)),
      series: downsample(series),
    }
  }
}
