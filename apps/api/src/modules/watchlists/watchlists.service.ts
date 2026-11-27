import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  Period,
  WatchlistDto,
  WatchlistEntryDto,
  WatchlistEntryInput,
  WatchlistInput,
  WatchlistSummary,
} from '@finance/shared'
import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, price, quote, watchlist, watchlistEntry } from '../../database/schema'
import { D, eurosToCents, ratio } from '../../domain/money'
import { addDays, daysBetween, resolvePeriod, todayIso } from '../../domain/period'
import { sparkline } from '../../domain/sparkline'
import { STALE_AFTER_DAYS } from '../../domain/snapshots'
import { InstrumentsService } from '../instruments/instruments.service'

/** Watchlists (US6): lists of securities with price change per period. */
const DEFAULT_WATCHLIST = 'Watchlist'

@Injectable()
export class WatchlistsService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly instruments: InstrumentsService,
  ) {}

  /** Watchlists for the page: like the reference a first "Watchlist" exists from the start (012 P10). */
  listForPage(): WatchlistSummary[] {
    if (!this.db.select({ id: watchlist.id }).from(watchlist).limit(1).get()) {
      this.db.insert(watchlist).values({ name: DEFAULT_WATCHLIST, position: 0 }).run()
    }
    return this.list()
  }

  list(): WatchlistSummary[] {
    return this.db
      .select({ id: watchlist.id, name: watchlist.name, count: count(watchlistEntry.instrumentId) })
      .from(watchlist)
      .leftJoin(watchlistEntry, eq(watchlistEntry.watchlistId, watchlist.id))
      .groupBy(watchlist.id)
      .orderBy(asc(watchlist.position), asc(watchlist.name))
      .all()
  }

  create(input: WatchlistInput): WatchlistSummary {
    this.assertFreeName(input.name)
    const position = this.list().length
    const row = this.db.insert(watchlist).values({ name: input.name, position }).returning().get()
    return { id: row.id, name: row.name, count: 0 }
  }

  rename(id: string, input: WatchlistInput): WatchlistSummary {
    this.assertFreeName(input.name, id)
    const row = this.db
      .update(watchlist)
      .set({ name: input.name })
      .where(eq(watchlist.id, id))
      .returning()
      .get()
    if (!row) throw new NotFoundException('Watchlist nicht gefunden')
    return this.list().find((w) => w.id === id)!
  }

  remove(id: string): void {
    if (this.db.delete(watchlist).where(eq(watchlist.id, id)).run().changes === 0) {
      throw new NotFoundException('Watchlist nicht gefunden')
    }
  }

  get(id: string, period: Period, today = todayIso()): WatchlistDto {
    const list = this.db.select().from(watchlist).where(eq(watchlist.id, id)).get()
    if (!list) throw new NotFoundException('Watchlist nicht gefunden')
    const entries = this.db
      .select({ instrumentId: instrument.id, name: instrument.name, isin: instrument.isin })
      .from(watchlistEntry)
      .innerJoin(instrument, eq(instrument.id, watchlistEntry.instrumentId))
      .where(eq(watchlistEntry.watchlistId, id))
      .orderBy(asc(watchlistEntry.position), asc(watchlistEntry.addedAt))
      .all()
    return {
      id: list.id,
      name: list.name,
      entries: entries.map((e) => this.entry(e, period, today)),
    }
  }

  private entry(
    item: { instrumentId: string; name: string; isin: string },
    period: Period,
    today: string,
  ): WatchlistEntryDto {
    const closeOn = (date: string) =>
      this.db
        .select({ date: price.date, close: price.close })
        .from(price)
        .where(and(eq(price.instrumentId, item.instrumentId), lte(price.date, date)))
        .orderBy(desc(price.date))
        .limit(1)
        .get()
    const latest = closeOn(today)
    if (!latest) {
      return {
        ...item,
        priceCents: null,
        priceDate: null,
        changeCents: null,
        changePct: null,
        stale: false,
        hasPrices: false,
      }
    }
    const first = this.db
      .select({ date: price.date, close: price.close })
      .from(price)
      .where(eq(price.instrumentId, item.instrumentId))
      .orderBy(asc(price.date))
      .limit(1)
      .get()!
    const { from } = resolvePeriod(period, today, first.date)
    // Last close on or before the period start; the first close when the period starts earlier.
    const baseClose = (closeOn(from) ?? first).close
    const change = new D(latest.close).minus(baseClose)
    const quotedAt =
      this.db
        .select({ quotedAt: quote.quotedAt })
        .from(quote)
        .where(eq(quote.instrumentId, item.instrumentId))
        .get()?.quotedAt ?? null
    const recent = this.db
      .select({ close: price.close })
      .from(price)
      .where(and(eq(price.instrumentId, item.instrumentId), gte(price.date, addDays(today, -30))))
      .orderBy(asc(price.date))
      .all()
      .map((row) => Number(row.close))
    return {
      ...item,
      quotedAt,
      sparkline: sparkline(recent),
      priceCents: eurosToCents(latest.close),
      priceDate: latest.date,
      changeCents: eurosToCents(change),
      changePct: ratio(change, baseClose, 6),
      stale: daysBetween(latest.date, today) > STALE_AFTER_DAYS,
      hasPrices: true,
    }
  }

  addEntry(id: string, input: WatchlistEntryInput): WatchlistDto {
    if (!this.db.select({ id: watchlist.id }).from(watchlist).where(eq(watchlist.id, id)).get()) {
      throw new NotFoundException('Watchlist nicht gefunden')
    }
    const target = this.instruments.findOrCreate(input.isin, input.name, input.assetClass)
    const exists = this.db
      .select()
      .from(watchlistEntry)
      .where(and(eq(watchlistEntry.watchlistId, id), eq(watchlistEntry.instrumentId, target.id)))
      .get()
    if (exists) throw new ConflictException('Wertpapier ist bereits auf der Watchlist')
    const position = this.db
      .select({ n: count() })
      .from(watchlistEntry)
      .where(eq(watchlistEntry.watchlistId, id))
      .get()!.n
    this.db
      .insert(watchlistEntry)
      .values({ watchlistId: id, instrumentId: target.id, position })
      .run()
    return this.get(id, '1Y')
  }

  removeEntry(id: string, instrumentId: string): void {
    const result = this.db
      .delete(watchlistEntry)
      .where(and(eq(watchlistEntry.watchlistId, id), eq(watchlistEntry.instrumentId, instrumentId)))
      .run()
    if (result.changes === 0) throw new NotFoundException('Eintrag nicht gefunden')
  }

  private assertFreeName(name: string, exceptId?: string): void {
    const existing = this.db
      .select({ id: watchlist.id })
      .from(watchlist)
      .where(eq(watchlist.name, name))
      .get()
    if (existing && existing.id !== exceptId) {
      throw new ConflictException('Eine Watchlist mit diesem Namen existiert bereits')
    }
  }
}
