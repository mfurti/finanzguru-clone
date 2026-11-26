/**
 * Daily value and invested amount per depot and instrument (004 US2, research
 * R4). Uses the exact depot snapshot computation, so the per-instrument rows
 * of a day add up to the depot snapshot to the cent; prices are carried
 * forward over gaps like in the depot chart.
 */
import {
  computeDepotSnapshots,
  type DailySnapshot,
  type HoldingValue,
  type PriceSeries,
} from './snapshots'

type DepotTx = Parameters<typeof computeDepotSnapshots>[1][number]

export function computeInstrumentValues(
  accountId: string,
  transactions: readonly DepotTx[],
  prices: PriceSeries,
  from: string,
  to: string,
): { snapshots: DailySnapshot[]; holdings: HoldingValue[] } {
  const holdings: HoldingValue[] = []
  const snapshots = computeDepotSnapshots(accountId, transactions, prices, from, to, (row) =>
    holdings.push(row),
  )
  return { snapshots, holdings }
}
