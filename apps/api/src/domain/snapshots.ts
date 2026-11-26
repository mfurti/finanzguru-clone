/**
 * Daily per-account values for the net-worth chart and return calculations.
 * Depots: market value of open lots (last known close carried forward),
 * cost basis as invested capital, buys/sells as external flows.
 * Cash accounts: balance per day, derived backwards from the current balance.
 */
import { D, type DecimalValue, eurosToCents } from './money'
import { daysBetween, eachDay } from './period'
import {
  applyPositionTx,
  investedCentsOf,
  newPosition,
  type PositionState,
  type PositionTx,
  quantityOf,
} from './positions'

export interface PricePoint {
  date: string
  close: string
}

/** Close prices per instrument, sorted by date ascending. */
export type PriceSeries = Map<string, PricePoint[]>

export interface DailySnapshot {
  accountId: string
  date: string
  valueCents: number
  investedCents: number
  externalFlowCents: number
  priceStale: boolean
}

/** A carried-forward price older than this many days counts as stale. */
export const STALE_AFTER_DAYS = 4

/** Walks a sorted price series forward as days advance (O(n) over a whole range). */
class PriceCursor {
  private index = -1

  constructor(private readonly points: readonly PricePoint[]) {}

  at(day: string): PricePoint | undefined {
    while (this.index + 1 < this.points.length && this.points[this.index + 1]!.date <= day) {
      this.index++
    }
    return this.index >= 0 ? this.points[this.index] : undefined
  }
}

function depotFlowCents(tx: PositionTx): number {
  const gross = tx.unitPrice
    ? eurosToCents(new D(tx.quantity ?? 0).times(tx.unitPrice))
    : Math.abs(tx.amountCents)
  if (tx.type === 'buy') return gross + tx.feeCents
  if (tx.type === 'sell') return -(gross - tx.feeCents - tx.taxCents)
  return 0
}

/** Snapshots of one depot for every day in `[from, to]`. */
/** Value and invested amount of one holding on one day (instrument_value_snapshot). */
export interface HoldingValue {
  accountId: string
  instrumentId: string
  date: string
  valueCents: number
  investedCents: number
  /** Net buys (+) minus sells (−) of this instrument on this day (005 R5). */
  flowCents: number
}

export function computeDepotSnapshots(
  accountId: string,
  transactions: readonly PositionTx[],
  prices: PriceSeries,
  from: string,
  to: string,
  /** Optional per-holding rows (004 US2); their sums equal the depot snapshot exactly. */
  perHolding?: (row: HoldingValue) => void,
): DailySnapshot[] {
  const sorted = [...transactions].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
  const states = new Map<string, PositionState>()
  const cursors = new Map<string, PriceCursor>()
  const apply = (tx: PositionTx) => {
    if (!tx.instrumentId) return
    let state = states.get(tx.instrumentId)
    if (!state) {
      state = newPosition(tx.instrumentId)
      states.set(tx.instrumentId, state)
      cursors.set(tx.instrumentId, new PriceCursor(prices.get(tx.instrumentId) ?? []))
    }
    applyPositionTx(state, tx)
  }

  let index = 0
  while (index < sorted.length && sorted[index]!.bookingDate < from) apply(sorted[index++]!)

  const result: DailySnapshot[] = []
  for (const day of eachDay(from, to)) {
    let flow = 0
    const dayFlows = new Map<string, number>()
    while (index < sorted.length && sorted[index]!.bookingDate === day) {
      const tx = sorted[index++]!
      const txFlow = depotFlowCents(tx)
      flow += txFlow
      if (tx.instrumentId && txFlow !== 0) {
        dayFlows.set(tx.instrumentId, (dayFlows.get(tx.instrumentId) ?? 0) + txFlow)
      }
      apply(tx)
    }

    // Rounded per holding, like a broker statement, so totals equal the sum of positions.
    let value = 0
    let invested = 0
    let stale = false
    for (const [instrumentId, state] of states) {
      const quantity = quantityOf(state)
      const holdingFlow = dayFlows.get(instrumentId) ?? 0
      if (quantity.lte(0)) {
        // Sold out today: keep the sale's flow so per-class returns see it (005 R5).
        if (holdingFlow !== 0) {
          perHolding?.({
            accountId,
            instrumentId,
            date: day,
            valueCents: 0,
            investedCents: 0,
            flowCents: holdingFlow,
          })
        }
        continue
      }
      const holdingInvested = investedCentsOf(state)
      invested += holdingInvested
      const point = cursors.get(instrumentId)!.at(day)
      let close: DecimalValue | null = point ? new D(point.close) : state.lastTradePrice
      if (!point || daysBetween(point.date, day) > STALE_AFTER_DAYS) stale = true
      close ??= new D(0)
      const holdingValue = eurosToCents(quantity.times(close))
      value += holdingValue
      perHolding?.({
        accountId,
        instrumentId,
        date: day,
        valueCents: holdingValue,
        investedCents: holdingInvested,
        flowCents: holdingFlow,
      })
    }
    result.push({
      accountId,
      date: day,
      valueCents: value,
      investedCents: invested,
      externalFlowCents: flow,
      priceStale: stale,
    })
  }
  return result
}

export interface CashTx {
  bookingDate: string
  amountCents: number
}

/**
 * Snapshots of one cash account. The balance at the end of day `d` is the
 * current balance minus everything booked after `d`.
 */
export function computeCashSnapshots(
  accountId: string,
  currentBalanceCents: number,
  transactions: readonly CashTx[],
  from: string,
  to: string,
): DailySnapshot[] {
  const byDay = new Map<string, number>()
  let afterTo = 0
  for (const tx of transactions) {
    if (tx.bookingDate > to) afterTo += tx.amountCents
    else byDay.set(tx.bookingDate, (byDay.get(tx.bookingDate) ?? 0) + tx.amountCents)
  }
  const days = eachDay(from, to)
  const result: DailySnapshot[] = Array.from({ length: days.length })
  let balance = currentBalanceCents - afterTo
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]!
    const flow = byDay.get(day) ?? 0
    result[i] = {
      accountId,
      date: day,
      valueCents: balance,
      investedCents: balance,
      externalFlowCents: flow,
      priceStale: false,
    }
    balance -= flow
  }
  return result
}

/** Booking types that move money on a broker's cash account when booked in the depot. */
const DEPOT_CASH_TYPES = new Set(['buy', 'sell', 'dividend', 'interest', 'tax', 'fee'])

/**
 * Cash bookings of a broker's reference account (010 R3): its own bookings plus the cash legs
 * of the parent depot's trades, dividends, interest, taxes and fees – but only when the
 * reference account books no trades itself (otherwise the legs are already there). Without
 * the legs, the balance rebuilt backwards from today misses sale proceeds between a sell and
 * a re-buy, and the value chart drops for those days.
 */
export function referenceCashTxs(
  own: readonly (CashTx & { type?: string })[],
  depot: readonly (CashTx & { type: string })[],
): CashTx[] {
  if (own.some((tx) => tx.type === 'buy' || tx.type === 'sell')) return [...own]
  const legs = depot
    .filter((tx) => DEPOT_CASH_TYPES.has(tx.type))
    .map((tx) => ({ bookingDate: tx.bookingDate, amountCents: tx.amountCents }))
  return [...own, ...legs]
}

/** First day a snapshot series needs: earliest booking, or `fallback`. */
export function firstBookingDate(
  transactions: readonly { bookingDate: string }[],
  fallback: string,
): string {
  let first = fallback
  for (const tx of transactions) if (tx.bookingDate < first) first = tx.bookingDate
  return first
}
