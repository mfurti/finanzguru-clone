import { Inject, Injectable } from '@nestjs/common'
import type {
  AssetClass,
  AssetClassDto,
  ClassPerformanceResponse,
  Period,
  PerformanceResponse,
  PositionDto,
  PositionsQuery,
} from '@finance/shared'
import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, instrumentValueSnapshot, price, transaction } from '../../database/schema'
import { classSeries } from '../../domain/class-performance'
import { D, eurosToCents, ratio } from '../../domain/money'
import { computePositions, summarize } from '../../domain/positions'
import { downsample, OverviewService } from '../overview/overview.service'
import { PortfolioService } from '../overview/portfolio.service'

@Injectable()
export class InvestmentsService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
    private readonly portfolio: PortfolioService,
  ) {}

  depotIds(accounts?: readonly string[]): string[] {
    return this.overview
      .resolveAccounts(accounts)
      .filter((acc) => acc.type === 'depot')
      .map((acc) => acc.id)
  }

  performance(query: {
    accounts?: string[]
    period: Period
    from?: string
    to?: string
  }): PerformanceResponse {
    const depots = this.overview
      .resolveAccounts(query.accounts)
      .filter((acc) => acc.type === 'depot')
    if (depots.length === 0) return { valueCents: 0, gainCents: 0, gainPct: null, series: [] }
    const range = this.overview.range(depots, query)
    const totals = this.overview.dailyTotals(depots, range)
    if (totals.length === 0) return { valueCents: 0, gainCents: 0, gainPct: null, series: [] }
    const first = totals[0]!
    const last = totals.at(-1)!
    const flows = totals.slice(1).reduce((sum, point) => sum + point.depotFlowCents, 0)
    const gainCents = last.depotValueCents - first.depotValueCents - flows
    return {
      valueCents: last.depotValueCents,
      gainCents,
      gainPct: ratio(gainCents, first.depotValueCents + Math.max(flows, 0), 6),
      series: downsample(
        totals.map((point) => ({
          date: point.date,
          valueCents: point.depotValueCents,
          investedCents: point.investedCents,
        })),
      ),
    }
  }

  /**
   * Lines per asset class for the chart chips (005 US2, research R5): value and time-weighted
   * return of each class from the per-instrument rows, plus the "Alle" line.
   */
  classPerformance(query: {
    accounts?: string[]
    period: Period
    from?: string
    to?: string
  }): ClassPerformanceResponse {
    const depots = this.overview
      .resolveAccounts(query.accounts)
      .filter((acc) => acc.type === 'depot')
    if (depots.length === 0) return { classes: [], series: [] }
    const range = this.overview.range(depots, query)
    const rows = this.db
      .select({
        date: instrumentValueSnapshot.date,
        assetClass: instrument.assetClass,
        valueCents: sql<number>`sum(${instrumentValueSnapshot.valueCents})`,
        flowCents: sql<number>`sum(${instrumentValueSnapshot.flowCents})`,
      })
      .from(instrumentValueSnapshot)
      .innerJoin(instrument, eq(instrument.id, instrumentValueSnapshot.instrumentId))
      .where(
        and(
          inArray(
            instrumentValueSnapshot.accountId,
            depots.map((d) => d.id),
          ),
          gte(instrumentValueSnapshot.date, range.from),
          lte(instrumentValueSnapshot.date, range.to),
        ),
      )
      .groupBy(instrumentValueSnapshot.date, instrument.assetClass)
      .all()
      .map((row) => ({
        ...row,
        valueCents: Number(row.valueCents),
        flowCents: Number(row.flowCents),
      }))
    const result = classSeries(rows, range.from, range.to)
    return { classes: result.classes, series: downsample(result.series) }
  }

  positions(query: PositionsQuery): PositionDto[] {
    const depots = this.depotIds(query.accounts)
    if (depots.length === 0) return []
    const rows = query.status === 'sold' ? this.soldPositions(depots) : this.openPositions(depots)
    return query.assetClass ? rows.filter((row) => row.assetClass === query.assetClass) : rows
  }

  assetClasses(accounts?: readonly string[]): AssetClassDto[] {
    const open = this.openPositions(this.depotIds(accounts))
    const total = open.reduce((sum, row) => sum + row.valueCents, 0)
    const groups = new Map<AssetClass, { valueCents: number; count: number }>()
    for (const row of open) {
      const group = groups.get(row.assetClass) ?? { valueCents: 0, count: 0 }
      group.valueCents += row.valueCents
      group.count += 1
      groups.set(row.assetClass, group)
    }
    return [...groups.entries()]
      .map(([assetClass, group]) => ({
        assetClass,
        ...group,
        pct: ratio(group.valueCents, total, 6),
      }))
      .sort((a, b) => b.valueCents - a.valueCents)
  }

  private openPositions(depots: string[]): PositionDto[] {
    const holdings = this.portfolio.openHoldings(depots)
    const total = holdings.reduce((sum, holding) => sum + holding.valueCents, 0)
    const meta = this.instrumentMeta(holdings.map((holding) => holding.instrumentId))
    const dividends = this.dividends(depots)
    return holdings
      .map((holding) => {
        const gainCents = holding.valueCents - holding.investedCents
        return {
          instrumentId: holding.instrumentId,
          name: holding.name,
          assetClass: holding.assetClass,
          wkn: meta.get(holding.instrumentId)?.wkn ?? null,
          isin: meta.get(holding.instrumentId)?.isin ?? '',
          priceCents: eurosToCents(holding.lastPrice),
          dayChangePct: this.dayChange(
            holding.instrumentId,
            holding.lastPrice,
            holding.lastPriceDate,
          ),
          quantity: holding.quantity,
          valueCents: holding.valueCents,
          entryValueCents: holding.investedCents,
          avgPrice: new D(holding.investedCents)
            .dividedBy(100)
            .dividedBy(holding.quantity)
            .toDecimalPlaces(4)
            .toString(),
          gainCents,
          gainPct: ratio(gainCents, holding.investedCents, 6),
          allocationPct: ratio(holding.valueCents, total, 6),
          dividendsCents: dividends.get(holding.instrumentId) ?? 0,
        }
      })
      .sort((a, b) => b.valueCents - a.valueCents)
  }

  private soldPositions(depots: string[]): PositionDto[] {
    const txs = this.db
      .select()
      .from(transaction)
      .where(inArray(transaction.accountId, depots))
      .all()
    const states = [...computePositions(txs).values()].map(summarize).filter((state) => state.sold)
    if (states.length === 0) return []
    const meta = this.instrumentMeta(states.map((state) => state.instrumentId))
    const dividends = this.dividends(depots)
    return states.map((state) => {
      const info = meta.get(state.instrumentId)
      return {
        instrumentId: state.instrumentId,
        name: info?.name ?? state.instrumentId,
        assetClass: info?.assetClass ?? 'other',
        wkn: info?.wkn ?? null,
        isin: info?.isin ?? '',
        priceCents: 0,
        dayChangePct: null,
        quantity: '0',
        valueCents: 0,
        entryValueCents: 0,
        avgPrice: null,
        gainCents: state.realizedGrossCents,
        gainPct: null,
        allocationPct: null,
        dividendsCents: dividends.get(state.instrumentId) ?? 0,
        realizedCents: state.realizedGrossCents,
      }
    })
  }

  private instrumentMeta(ids: string[]) {
    if (ids.length === 0) return new Map<string, typeof instrument.$inferSelect>()
    const rows = this.db.select().from(instrument).where(inArray(instrument.id, ids)).all()
    return new Map(rows.map((row) => [row.id, row]))
  }

  private dividends(depots: string[]): Map<string, number> {
    const result = new Map<string, number>()
    if (depots.length === 0) return result
    const rows = this.db
      .select({ instrumentId: transaction.instrumentId, amount: transaction.amountCents })
      .from(transaction)
      .where(and(inArray(transaction.accountId, depots), eq(transaction.type, 'dividend')))
      .all()
    for (const row of rows) {
      if (row.instrumentId)
        result.set(row.instrumentId, (result.get(row.instrumentId) ?? 0) + row.amount)
    }
    return result
  }

  private dayChange(instrumentId: string, last: string, lastDate: string | null): string | null {
    if (!lastDate) return null
    const previous = this.db
      .select({ close: price.close })
      .from(price)
      .where(and(eq(price.instrumentId, instrumentId), lt(price.date, lastDate)))
      .orderBy(desc(price.date))
      .limit(1)
      .get()
    return previous ? ratio(new D(last).minus(previous.close), previous.close, 6) : null
  }
}
