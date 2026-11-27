import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import { DEMO_BENCHMARK, DEMO_INSTRUMENTS, DEMO_START } from '../../database/demo'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  customGrouping,
  exemptionOrder,
  institution,
  instrument,
  price,
  transaction,
  watchlist,
  watchlistEntry,
} from '../../database/schema'
import { RecomputeService } from '../import/recompute.service'

export interface DemoRemoval {
  institutions: number
  accounts: number
  transactions: number
  instruments: number
  prices: number
}

const DEMO_ISINS = [...DEMO_INSTRUMENTS.map((item) => item.isin), DEMO_BENCHMARK.isin]
const DEMO_WATCHLIST = 'Beobachten'
const DEMO_GROUPING = 'Kern/Satellit'

/**
 * Removes everything the demo seed created (013 US1) in one transaction, so every sum shows
 * only the owner's data: demo institutions with their accounts (bookings, snapshots and lots
 * follow by cascade) and exemption orders, the demo watchlist and grouping, demo-only
 * instruments with their prices. Instruments the owner also holds stay, but lose the demo's
 * manual prices; the owner's holders are recomputed from the demo start.
 */
@Injectable()
export class DemoService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly recompute: RecomputeService,
  ) {}

  exists(): boolean {
    return !!this.db
      .select({ id: institution.id })
      .from(institution)
      .where(eq(institution.isDemo, true))
      .get()
  }

  remove(): DemoRemoval {
    const institutions = this.db
      .select({ id: institution.id })
      .from(institution)
      .where(eq(institution.isDemo, true))
      .all()
      .map((row) => row.id)
    if (institutions.length === 0) throw new NotFoundException('Keine Demo-Daten vorhanden')

    return this.db.transaction((tx) => {
      const accounts = tx
        .select({ id: account.id })
        .from(account)
        .where(inArray(account.institutionId, institutions))
        .all()
        .map((row) => row.id)
      const transactions =
        accounts.length === 0
          ? 0
          : tx
              .select({ id: transaction.id })
              .from(transaction)
              .where(inArray(transaction.accountId, accounts))
              .all().length
      if (accounts.length > 0) {
        tx.update(account)
          .set({ parentAccountId: null })
          .where(inArray(account.parentAccountId, accounts))
          .run()
        tx.delete(account).where(inArray(account.id, accounts)).run()
      }
      tx.delete(exemptionOrder).where(inArray(exemptionOrder.institutionId, institutions)).run()
      tx.delete(institution).where(inArray(institution.id, institutions)).run()

      const demoWatchlist = tx
        .select({ id: watchlist.id })
        .from(watchlist)
        .where(eq(watchlist.name, DEMO_WATCHLIST))
        .get()
      if (demoWatchlist) tx.delete(watchlist).where(eq(watchlist.id, demoWatchlist.id)).run()
      tx.delete(customGrouping).where(eq(customGrouping.name, DEMO_GROUPING)).run()

      // Demo instruments: gone when the owner does not use them, else only the demo prices.
      const demo = tx
        .select({ id: instrument.id })
        .from(instrument)
        .where(inArray(instrument.isin, DEMO_ISINS))
        .all()
        .map((row) => row.id)
      const used = new Set(
        demo.length === 0
          ? []
          : [
              ...tx
                .select({ id: transaction.instrumentId })
                .from(transaction)
                .where(inArray(transaction.instrumentId, demo))
                .all()
                .map((row) => row.id!),
              ...tx
                .select({ id: watchlistEntry.instrumentId })
                .from(watchlistEntry)
                .where(inArray(watchlistEntry.instrumentId, demo))
                .all()
                .map((row) => row.id),
            ],
      )
      const unused = demo.filter((id) => !used.has(id))
      const kept = demo.filter((id) => used.has(id))
      let prices = 0
      if (kept.length > 0) {
        prices += tx
          .delete(price)
          .where(and(inArray(price.instrumentId, kept), eq(price.source, 'manual')))
          .run().changes
      }
      if (unused.length > 0) {
        prices += tx
          .select({ id: price.instrumentId })
          .from(price)
          .where(inArray(price.instrumentId, unused))
          .all().length
        tx.delete(instrument)
          .where(and(inArray(instrument.id, unused), notInArray(instrument.id, kept)))
          .run()
      }
      if (kept.length > 0) this.recompute.recomputeHolders(tx, kept, DEMO_START)

      return {
        institutions: institutions.length,
        accounts: accounts.length,
        transactions,
        instruments: unused.length,
        prices,
      }
    })
  }
}
