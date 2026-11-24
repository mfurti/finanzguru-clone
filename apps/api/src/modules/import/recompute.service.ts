import { Injectable } from '@nestjs/common'
import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  instrumentValueSnapshot,
  netWorthSnapshot,
  positionLot,
  price,
  transaction,
} from '../../database/schema'
import { computeInstrumentValues } from '../../domain/instrument-values'
import { todayIso } from '../../domain/period'
import { computePositions } from '../../domain/positions'
import {
  computeCashSnapshots,
  type DailySnapshot,
  firstBookingDate,
  type PriceSeries,
} from '../../domain/snapshots'

/** Rows per INSERT; SQLite allows 32766 bound parameters, a snapshot row has 6. */
const CHUNK = 1000

type Db = Pick<AppDatabase, 'select' | 'insert' | 'delete'>

/**
 * Rebuilds the derived tables `position_lot` and `net_worth_snapshot`.
 * Runs inside the caller's DB transaction (pass the transaction as `db`),
 * so an import and its recomputation commit or roll back together.
 */
@Injectable()
export class RecomputeService {
  recompute(db: Db, accountIds: readonly string[], from?: string, today = todayIso()): void {
    if (accountIds.length === 0) return
    const accounts = db
      .select()
      .from(account)
      .where(inArray(account.id, [...accountIds]))
      .all()

    for (const acc of accounts) {
      const txs = db
        .select()
        .from(transaction)
        .where(eq(transaction.accountId, acc.id))
        .orderBy(asc(transaction.bookingDate), asc(transaction.createdAt))
        .all()
      // Rebuild from `from` (or the first booking), never before the first booking.
      const first = firstBookingDate(txs, today)
      let start = from && from > first ? from : first
      if (start > today) start = today

      let snapshots: DailySnapshot[]
      if (acc.type === 'depot') {
        const instrumentIds = [
          ...new Set(txs.map((tx) => tx.instrumentId).filter((id): id is string => !!id)),
        ]
        const prices: PriceSeries = new Map()
        if (instrumentIds.length > 0) {
          const rows = db
            .select()
            .from(price)
            .where(inArray(price.instrumentId, instrumentIds))
            .orderBy(asc(price.instrumentId), asc(price.date))
            .all()
          for (const row of rows) {
            const series = prices.get(row.instrumentId) ?? []
            series.push({ date: row.date, close: row.close })
            prices.set(row.instrumentId, series)
          }
        }
        const computed = computeInstrumentValues(acc.id, txs, prices, start, today)
        snapshots = computed.snapshots
        db.delete(instrumentValueSnapshot)
          .where(
            and(
              eq(instrumentValueSnapshot.accountId, acc.id),
              gte(instrumentValueSnapshot.date, start),
            ),
          )
          .run()
        for (let i = 0; i < computed.holdings.length; i += CHUNK) {
          db.insert(instrumentValueSnapshot)
            .values(computed.holdings.slice(i, i + CHUNK))
            .run()
        }

        db.delete(positionLot).where(eq(positionLot.accountId, acc.id)).run()
        const lots = [...computePositions(txs).values()].flatMap((state) =>
          state.lots.map((lot) => ({
            accountId: acc.id,
            instrumentId: state.instrumentId,
            openDate: lot.openDate,
            quantityOpen: lot.quantity.toString(),
            costPerUnit: lot.costPerUnit.toDecimalPlaces(10).toString(),
            closed: false,
          })),
        )
        for (let i = 0; i < lots.length; i += CHUNK) {
          db.insert(positionLot)
            .values(lots.slice(i, i + CHUNK))
            .run()
        }
      } else {
        snapshots = computeCashSnapshots(acc.id, acc.balanceCents, txs, start, today)
      }

      db.delete(netWorthSnapshot)
        .where(and(eq(netWorthSnapshot.accountId, acc.id), gte(netWorthSnapshot.date, start)))
        .run()
      for (let i = 0; i < snapshots.length; i += CHUNK) {
        db.insert(netWorthSnapshot)
          .values(snapshots.slice(i, i + CHUNK))
          .run()
      }
    }
  }
}
