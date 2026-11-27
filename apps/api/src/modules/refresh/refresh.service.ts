import { Inject, Injectable } from '@nestjs/common'
import { desc, inArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { dataSource, quote, transaction } from '../../database/schema'
import { MarketDataService } from '../market-data/market-data.service'
import { SyncService } from '../sources/sync.service'

export interface RefreshResult {
  source: string
  name: string
  ok: boolean
  at: string
  error: string | null
}

export interface SourceState {
  source: string
  name: string
  lastSuccessAt: string | null
  lastError: string | null
}

export interface DataState {
  /** Oldest last success among connected sources: the honest "Stand" of the app. */
  oldestSuccessAt: string | null
  outdated: boolean
  sources: SourceState[]
  /** Newest booking date: the state when no source is connected (CSV only). */
  newestBookingDate: string | null
}

const PULL_KINDS = ['enable_banking', 'scalable_mcp'] as const
const QUOTES = 'quotes'
const OUTDATED_MS = 24 * 60 * 60 * 1000

/**
 * "Aktualisieren" on the Übersicht (013 US2): fetch every connected source one after another
 * (bank sync, broker sync, then quotes) and report each result; plus the data state shown as
 * "Stand: …" with the time per source.
 */
@Injectable()
export class RefreshService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly sync: SyncService,
    private readonly marketData: MarketDataService,
  ) {}

  private connected() {
    return this.db
      .select()
      .from(dataSource)
      .where(inArray(dataSource.kind, [...PULL_KINDS]))
      .all()
      .filter((row) => row.status !== 'disabled' && row.status !== 'planned')
      .filter((row) => this.sync.canSync(row.id))
  }

  async refreshAll(): Promise<RefreshResult[]> {
    const results: RefreshResult[] = []
    for (const row of this.connected()) {
      try {
        const outcome = await this.sync.run(row.id)
        results.push({
          source: row.id,
          name: row.displayName,
          ok: outcome.status !== 'failed',
          at: new Date().toISOString(),
          error: outcome.error,
        })
      } catch (cause) {
        results.push({
          source: row.id,
          name: row.displayName,
          ok: false,
          at: new Date().toISOString(),
          error: cause instanceof Error ? cause.message : String(cause),
        })
      }
    }
    if (this.marketData.available()) {
      try {
        await this.marketData.refresh()
        results.push({
          source: QUOTES,
          name: 'Kurse',
          ok: true,
          at: new Date().toISOString(),
          error: null,
        })
      } catch (cause) {
        results.push({
          source: QUOTES,
          name: 'Kurse',
          ok: false,
          at: new Date().toISOString(),
          error: cause instanceof Error ? cause.message : String(cause),
        })
      }
    }
    return results
  }

  state(now = Date.now()): DataState {
    const sources: SourceState[] = this.connected().map((row) => ({
      source: row.id,
      name: row.displayName,
      lastSuccessAt: row.lastSyncAt,
      lastError: row.lastError,
    }))
    if (this.marketData.available()) {
      const last = this.db
        .select({ at: quote.fetchedAt })
        .from(quote)
        .orderBy(desc(quote.fetchedAt))
        .limit(1)
        .get()
      sources.push({
        source: QUOTES,
        name: 'Kurse',
        lastSuccessAt: last?.at ?? null,
        lastError: null,
      })
    }
    const known = sources
      .map((row) => row.lastSuccessAt)
      .filter((at): at is string => at !== null)
      .sort()
    const oldestSuccessAt = known[0] ?? null
    // Outdated: a connected source never fetched, or the oldest fetch older than 24 h.
    const outdated =
      sources.length > 0 &&
      (known.length < sources.length || now - Date.parse(oldestSuccessAt!) > OUTDATED_MS)
    const newest = this.db
      .select({ date: transaction.bookingDate })
      .from(transaction)
      .orderBy(desc(transaction.bookingDate))
      .limit(1)
      .get()
    return {
      oldestSuccessAt,
      outdated,
      sources,
      newestBookingDate: newest?.date ?? null,
    }
  }
}
