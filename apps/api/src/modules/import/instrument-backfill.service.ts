import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { count, eq, inArray, ne } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, instrumentValueSnapshot, transaction } from '../../database/schema'
import { RecomputeService } from './recompute.service'

/**
 * Databases from before 004 have depot snapshots but no per-instrument rows.
 * On startup, when the table is empty and depots exist, rebuild the depots
 * once so the asset-class chart has data (004 T014).
 * Rows from before 005 have no daily flows (`flow_cents` = 0 everywhere although
 * buys or sells exist); those depots are rebuilt once as well (005 T006).
 */
@Injectable()
export class InstrumentBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InstrumentBackfillService.name)

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly recompute: RecomputeService,
  ) {}

  onApplicationBootstrap(): void {
    this.backfill()
  }

  /** Returns the number of depots rebuilt (0 when nothing was missing). */
  backfill(): number {
    const existing = this.db.select({ n: count() }).from(instrumentValueSnapshot).get()?.n ?? 0
    if (existing > 0 && !this.flowsMissing()) return 0
    const depots = this.db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.type, 'depot'))
      .all()
      .map((row) => row.id)
    if (depots.length === 0) return 0
    this.db.transaction((tx) => this.recompute.recompute(tx, depots))
    this.logger.log(`Rebuilt per-instrument values for ${depots.length} depot(s)`)
    return depots.length
  }

  /** True when per-instrument rows exist but none carries a flow although trades exist. */
  private flowsMissing(): boolean {
    const withFlow =
      this.db
        .select({ n: count() })
        .from(instrumentValueSnapshot)
        .where(ne(instrumentValueSnapshot.flowCents, 0))
        .get()?.n ?? 0
    if (withFlow > 0) return false
    const trades =
      this.db
        .select({ n: count() })
        .from(transaction)
        .where(inArray(transaction.type, ['buy', 'sell']))
        .get()?.n ?? 0
    return trades > 0
  }
}
