import { Inject, Injectable } from '@nestjs/common'
import type {
  AssetClass,
  AssetClassDto,
  Period,
  PerformanceResponse,
  PositionDto,
  PositionsQuery,
} from '@finance/shared'
import { and, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, instrumentValueSnapshot, price, transaction } from '../../database/schema'
import { eachDay } from '../../domain/period'
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
    assetClass?: AssetClass
  }): PerformanceResponse {
    const depots = this.overview
      .resolveAccounts(query.accounts)
      .filter((acc) => acc.type === 'depot')
    if (depots.length === 0) return { valueCents: 0, gainCents: 0, gainPct: null, series: [] }
    const range = this.overview.range(depots, query)
    if (query.assetClass) return this.assetClassPerformance(depots, range, query.assetClass)
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
   * Performance of one asset class (004 US2) from the per-instrument values.
   * Days without a holding count as 0. Gain = change of (value − invested),
   * i.e. the unrealized gain over the period; % relative to the invested amount.
   */
  private assetClassPerformance(
    depots: readonly { id: string }[],
    range: { from: string; to: string },
    assetClass: AssetClass,
  ): PerformanceResponse {
    const rows = this.db
      .select({
        date: instrumentValueSnapshot.date,
        valueCents: sql<number>`sum(${instrumentValueSnapshot.valueCents})`,
        investedCents: sql<number>`sum(${instrumentValueSnapshot.investedCents})`,
      })
      .from(instrumentValueSnapshot)
      .innerJoin(instrument, eq(instrument.id, instrumentValueSnapshot.instrumentId))
      .where(
        and(
          inArray(
            instrumentValueSnapshot.accountId,
            depots.map((d) => d.id),
          ),
          eq(instrument.assetClass, assetClass),
          gte(instrumentValueSnapshot.date, range.from),
          lte(instrumentValueSnapshot.date, range.to),
        ),
      )
      .groupBy(instrumentValueSnapshot.date)
      .all()
    const byDate = new Map(rows.map((row) => [row.date, row]))
    const series = eachDay(range.from, range.to).map((date) => ({
      date,
      valueCents: Number(byDate.get(date)?.valueCents ?? 0),
      investedCents: Number(byDate.get(date)?.investedCents ?? 0),
    }))
    if (series.length === 0) return { valueCents: 0, gainCents: 0, gainPct: null, series: [] }
    const first = series[0]!
    const last = series.at(-1)!
    const gainCents =
      last.valueCents - last.investedCents - (first.valueCents - first.investedCents)
    return {
      valueCents: last.valueCents,
      gainCents,
      gainPct: last.investedCents > 0 ? ratio(gainCents, last.investedCents, 6) : null,
      series: downsample(series),
    }
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
