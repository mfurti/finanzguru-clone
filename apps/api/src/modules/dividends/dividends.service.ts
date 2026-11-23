import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { DividendCalendarEntry, DividendSummary, ExpectedDividendInput } from '@finance/shared'
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { expectedDividend, instrument, transaction } from '../../database/schema'
import {
  type DividendBooking,
  dividendFigures,
  dividendsBySecurity,
  isReceived,
} from '../../domain/dividends'
import { valueCents } from '../../domain/money'
import { addMonths, todayIso } from '../../domain/period'
import { computePositions, quantityOf } from '../../domain/positions'
import { OverviewService } from '../overview/overview.service'

/** Dividenden page (US2): summary, history, per security and calendar. */
@Injectable()
export class DividendsService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  private depots(accounts?: readonly string[]) {
    return this.overview.resolveAccounts(accounts).filter((acc) => acc.type === 'depot')
  }

  private bookings(depotIds: readonly string[]): DividendBooking[] {
    if (depotIds.length === 0) return []
    return this.db
      .select({
        date: transaction.bookingDate,
        instrumentId: transaction.instrumentId,
        cents: transaction.amountCents,
      })
      .from(transaction)
      .where(and(inArray(transaction.accountId, [...depotIds]), eq(transaction.type, 'dividend')))
      .orderBy(asc(transaction.bookingDate))
      .all()
      .filter((row): row is DividendBooking => row.instrumentId !== null)
  }

  private names(ids: readonly string[]): Map<string, string> {
    if (ids.length === 0) return new Map()
    return new Map(
      this.db
        .select({ id: instrument.id, name: instrument.name })
        .from(instrument)
        .where(inArray(instrument.id, [...ids]))
        .all()
        .map((row) => [row.id, row.name]),
    )
  }

  summary(query: { accounts?: string[]; year?: number }, today = todayIso()): DividendSummary {
    const depots = this.depots(query.accounts)
    const bookings = this.bookings(depots.map((d) => d.id))
    const yearStart = `${today.slice(0, 4)}-01-01`
    const totals = this.overview.dailyTotals(depots, { from: yearStart, to: today })
    const average =
      totals.length > 0
        ? Math.round(totals.reduce((s, t) => s + t.depotValueCents, 0) / totals.length)
        : null
    const figures = dividendFigures(bookings, today, average)

    const window = query.year
      ? bookings.filter((b) => b.date.startsWith(String(query.year)))
      : bookings.filter((b) => b.date > addMonths(today, -12) && b.date <= today)
    const bySecurity = dividendsBySecurity(window)
    const names = this.names(bySecurity.map((row) => row.instrumentId))
    return {
      ...figures,
      bySecurity: bySecurity.map((row) => ({ ...row, name: names.get(row.instrumentId) ?? '' })),
    }
  }

  /** Received dividends plus expected payments not yet received, sorted by date. */
  calendar(
    query: { accounts?: string[]; from?: string; to?: string },
    today = todayIso(),
  ): DividendCalendarEntry[] {
    const from = query.from ?? addMonths(today, -6)
    const to = query.to ?? addMonths(today, 12)
    const depotIds = this.depots(query.accounts).map((d) => d.id)
    const bookings = this.bookings(depotIds)
    const received = bookings.filter((b) => b.date >= from && b.date <= to)
    const expected = this.db
      .select()
      .from(expectedDividend)
      .where(and(gte(expectedDividend.payDate, from), lte(expectedDividend.payDate, to)))
      .all()
      .filter((row) => !isReceived(bookings, row.instrumentId, row.payDate))

    const txs =
      depotIds.length > 0
        ? this.db
            .select()
            .from(transaction)
            .where(inArray(transaction.accountId, depotIds))
            .orderBy(asc(transaction.bookingDate), asc(transaction.createdAt))
            .all()
        : []
    const quantityOn = (instrumentId: string, date: string) => {
      const state = computePositions(
        txs.filter((tx) => tx.instrumentId === instrumentId && tx.bookingDate <= date),
      ).get(instrumentId)
      return state ? quantityOf(state).toString() : '0'
    }

    const names = this.names([
      ...new Set([...received.map((b) => b.instrumentId), ...expected.map((e) => e.instrumentId)]),
    ])
    return [
      ...received.map((b) => ({
        id: null,
        date: b.date,
        instrumentId: b.instrumentId,
        name: names.get(b.instrumentId) ?? '',
        status: 'received' as const,
        cents: b.cents,
        amountPerShare: null,
        exDate: null,
        note: null,
      })),
      ...expected.map((e) => ({
        id: e.id,
        date: e.payDate,
        instrumentId: e.instrumentId,
        name: names.get(e.instrumentId) ?? '',
        status: 'expected' as const,
        cents: valueCents(quantityOn(e.instrumentId, e.payDate), e.amountPerShare),
        amountPerShare: e.amountPerShare,
        exDate: e.exDate,
        note: e.note,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date))
  }

  create(input: ExpectedDividendInput): { id: string } {
    this.assertInstrument(input.instrumentId)
    return this.db
      .insert(expectedDividend)
      .values(this.values(input))
      .returning({ id: expectedDividend.id })
      .get()
  }

  update(id: string, input: ExpectedDividendInput): { id: string } {
    this.assertInstrument(input.instrumentId)
    const row = this.db
      .update(expectedDividend)
      .set(this.values(input))
      .where(eq(expectedDividend.id, id))
      .returning({ id: expectedDividend.id })
      .get()
    if (!row) throw new NotFoundException('Erwartete Zahlung nicht gefunden')
    return row
  }

  remove(id: string): void {
    if (this.db.delete(expectedDividend).where(eq(expectedDividend.id, id)).run().changes === 0) {
      throw new NotFoundException('Erwartete Zahlung nicht gefunden')
    }
  }

  private values(input: ExpectedDividendInput) {
    return {
      instrumentId: input.instrumentId,
      payDate: input.payDate,
      exDate: input.exDate ?? null,
      amountPerShare: input.amountPerShare,
      note: input.note ?? null,
    }
  }

  private assertInstrument(id: string): void {
    if (
      !this.db.select({ id: instrument.id }).from(instrument).where(eq(instrument.id, id)).get()
    ) {
      throw new BadRequestException('Wertpapier nicht gefunden')
    }
  }
}
