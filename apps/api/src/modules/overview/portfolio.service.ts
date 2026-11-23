import { Inject, Injectable } from '@nestjs/common'
import type {
  AllocationResponse,
  AssetClass,
  Holding,
  KpiResponse,
  Period,
  TopFlopResponse,
} from '@finance/shared'
import { and, asc, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, owner, positionLot, price, transaction } from '../../database/schema'
import { D, eurosToCents, ratio } from '../../domain/money'
import { addDays, addMonths, todayIso } from '../../domain/period'
import { computePositions } from '../../domain/positions'
import { periodCashFlows, realReturn, twror, xirr } from '../../domain/returns'
import { OverviewService } from './overview.service'

export const ASSET_CLASS_LABELS: Record<AssetClass | 'cash', string> = {
  stock: 'Aktien',
  etf: 'ETF',
  fund: 'Fonds',
  bond: 'Anleihen',
  crypto: 'Krypto',
  commodity: 'Rohstoffe',
  other: 'Sonstige',
  cash: 'Cash',
}

const DEFAULT_INFLATION = '0.0253'

export interface OpenHolding {
  instrumentId: string
  name: string
  assetClass: AssetClass
  quantity: string
  investedCents: number
  /** Latest close (EUR) or, without prices, the average cost. */
  lastPrice: string
  lastPriceDate: string | null
  valueCents: number
}

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  /** Open positions of the given depots, valued at the latest close. */
  openHoldings(depotIds: readonly string[]): OpenHolding[] {
    if (depotIds.length === 0) return []
    const lots = this.db
      .select({
        instrumentId: positionLot.instrumentId,
        quantity: positionLot.quantityOpen,
        cost: positionLot.costPerUnit,
        name: instrument.name,
        assetClass: instrument.assetClass,
      })
      .from(positionLot)
      .innerJoin(instrument, eq(instrument.id, positionLot.instrumentId))
      .where(inArray(positionLot.accountId, [...depotIds]))
      .all()

    const grouped = new Map<
      string,
      {
        name: string
        assetClass: AssetClass
        quantity: InstanceType<typeof D>
        invested: InstanceType<typeof D>
      }
    >()
    for (const lot of lots) {
      const entry = grouped.get(lot.instrumentId) ?? {
        name: lot.name,
        assetClass: lot.assetClass,
        quantity: new D(0),
        invested: new D(0),
      }
      entry.quantity = entry.quantity.plus(lot.quantity)
      entry.invested = entry.invested.plus(new D(lot.quantity).times(lot.cost))
      grouped.set(lot.instrumentId, entry)
    }

    return [...grouped.entries()]
      .filter(([, entry]) => entry.quantity.gt(0))
      .map(([instrumentId, entry]) => {
        const latest = this.db
          .select({ date: price.date, close: price.close })
          .from(price)
          .where(eq(price.instrumentId, instrumentId))
          .orderBy(desc(price.date))
          .limit(1)
          .get()
        const lastPrice = latest
          ? latest.close
          : entry.invested.dividedBy(entry.quantity).toString()
        return {
          instrumentId,
          name: entry.name,
          assetClass: entry.assetClass,
          quantity: entry.quantity.toString(),
          investedCents: eurosToCents(entry.invested),
          lastPrice,
          lastPriceDate: latest?.date ?? null,
          valueCents: eurosToCents(entry.quantity.times(lastPrice)),
        }
      })
  }

  allocation(accountIds?: readonly string[]): AllocationResponse {
    const accounts = this.overview.resolveAccounts(accountIds)
    const depots = accounts.filter((acc) => acc.type === 'depot').map((acc) => acc.id)
    const holdings = this.openHoldings(depots)

    const slices = new Map<string, { count: number; valueCents: number }>()
    for (const holding of holdings) {
      const slice = slices.get(holding.assetClass) ?? { count: 0, valueCents: 0 }
      slice.count += 1
      slice.valueCents += holding.valueCents
      slices.set(holding.assetClass, slice)
    }

    // Cash = latest value of every non-depot account in the selection.
    const today = todayIso()
    const cashAccounts = accounts.filter((acc) => acc.type !== 'depot')
    if (cashAccounts.length > 0) {
      const totals = this.overview.dailyTotals(cashAccounts, { from: today, to: today })
      const cash = totals.at(-1)?.valueCents ?? 0
      if (cash !== 0) slices.set('cash', { count: cashAccounts.length, valueCents: cash })
    }

    const totalCents = [...slices.values()].reduce((sum, slice) => sum + slice.valueCents, 0)
    return {
      totalCents,
      slices: [...slices.entries()]
        .map(([key, slice]) => ({
          key,
          label: ASSET_CLASS_LABELS[key as AssetClass | 'cash'] ?? key,
          count: slice.count,
          valueCents: slice.valueCents,
          pct: ratio(slice.valueCents, totalCents, 6),
        }))
        .sort((a, b) => b.valueCents - a.valueCents),
    }
  }

  kpis(query: { accounts?: string[]; period: Period; from?: string; to?: string }): KpiResponse {
    const accounts = this.overview.resolveAccounts(query.accounts)
    const range = this.overview.range(accounts, query)
    const depots = accounts.filter((acc) => acc.type === 'depot')
    const depotIds = depots.map((acc) => acc.id)
    const accountIds = accounts.map((acc) => acc.id)

    const investedCents = this.openHoldings(depotIds).reduce((sum, h) => sum + h.investedCents, 0)

    // Realized gains booked inside the range = FIFO result up to `to` minus up to `from`.
    const depotTxs =
      depotIds.length > 0
        ? this.db
            .select()
            .from(transaction)
            .where(
              and(inArray(transaction.accountId, depotIds), lte(transaction.bookingDate, range.to)),
            )
            .orderBy(asc(transaction.bookingDate))
            .all()
        : []
    const realizedUntil = (txs: typeof depotTxs) => {
      let gross = 0
      let net = 0
      for (const state of computePositions(txs).values()) {
        gross += state.realizedGrossCents
        net += state.realizedNetCents
      }
      return { gross, net }
    }
    const before = realizedUntil(depotTxs.filter((tx) => tx.bookingDate < range.from))
    const until = realizedUntil(depotTxs)
    const realizedGross = until.gross - before.gross
    const realizedNet = until.net - before.net

    const inRange =
      accountIds.length > 0
        ? this.db
            .select()
            .from(transaction)
            .where(
              and(
                inArray(transaction.accountId, accountIds),
                gte(transaction.bookingDate, range.from),
                lte(transaction.bookingDate, range.to),
              ),
            )
            .all()
        : []
    const depotSet = new Set(depotIds)
    let dividendsNet = 0
    let dividendsTax = 0
    let interestNet = 0
    let interestTax = 0
    let taxesFees = 0
    let tradeFees = 0
    for (const tx of inRange) {
      if (tx.type === 'dividend') {
        dividendsNet += tx.amountCents
        dividendsTax += tx.taxCents
      } else if (tx.type === 'interest') {
        interestNet += tx.amountCents
        interestTax += tx.taxCents
      } else if (depotSet.has(tx.accountId) && (tx.type === 'tax' || tx.type === 'fee')) {
        taxesFees += Math.abs(tx.amountCents)
      }
      if (depotSet.has(tx.accountId)) {
        taxesFees += tx.feeCents + tx.taxCents
        if (tx.type === 'buy' || tx.type === 'sell') tradeFees += tx.feeCents + tx.taxCents
      }
    }

    const totals = this.overview.dailyTotals(depots, range)
    const depotSeries = totals.map((point) => ({
      date: point.date,
      valueCents: point.depotValueCents,
      flowCents: point.depotFlowCents,
    }))
    const first = depotSeries[0]
    const last = depotSeries.at(-1)
    const flows = depotSeries.slice(1).reduce((sum, point) => sum + point.flowCents, 0)
    const changeCents = first && last ? last.valueCents - first.valueCents - flows : 0
    // The value change already contains realized results and trade costs; isolate pure price moves.
    const priceGainCents = changeCents - realizedGross + tradeFees

    const twr = twror(depotSeries)
    const inflation =
      this.db.select({ rate: owner.inflationRate }).from(owner).get()?.rate ?? DEFAULT_INFLATION

    return {
      investedCents,
      priceGain: { cents: priceGainCents, pct: ratio(priceGainCents, investedCents, 6) },
      realized: {
        grossCents: realizedGross,
        netCents: realizedNet,
        pct: ratio(realizedGross, investedCents, 6),
      },
      otherGainsCents: 0,
      dividends: { grossCents: dividendsNet + dividendsTax, netCents: dividendsNet },
      interest: { grossCents: interestNet + interestTax, netCents: interestNet },
      taxesFeesCents: -taxesFees,
      totalReturnCents:
        priceGainCents +
        realizedGross +
        dividendsNet +
        dividendsTax +
        interestNet +
        interestTax -
        taxesFees,
      twror: twr,
      irr: depotSeries.length > 1 ? xirr(periodCashFlows(depotSeries)) : null,
      inflation,
      realReturn: realReturn(twr, inflation),
    }
  }

  topFlop(
    query: { accounts?: string[]; range: '1D' | '1W' | '1M' | '1Y' },
    today = todayIso(),
  ): TopFlopResponse {
    const accounts = this.overview.resolveAccounts(query.accounts)
    const depots = accounts.filter((acc) => acc.type === 'depot').map((acc) => acc.id)
    const holdings = this.openHoldings(depots).filter((holding) => holding.lastPriceDate)

    const items: Holding[] = holdings.map((holding) => {
      const reference = this.referencePrice(
        holding.instrumentId,
        holding.lastPriceDate!,
        query.range,
        today,
      )
      const now = new D(holding.lastPrice)
      const change = reference ? now.minus(reference) : new D(0)
      return {
        instrumentId: holding.instrumentId,
        name: holding.name,
        priceCents: eurosToCents(now),
        changePct: reference ? ratio(change, reference, 6) : null,
        changeCents: eurosToCents(change.times(holding.quantity)),
      }
    })
    const withChange = items.filter((item) => item.changePct !== null)
    return {
      top: withChange
        .filter((item) => Number(item.changePct) > 0)
        .sort((a, b) => Number(b.changePct) - Number(a.changePct))
        .slice(0, 3),
      flop: withChange
        .filter((item) => Number(item.changePct) < 0)
        .sort((a, b) => Number(a.changePct) - Number(b.changePct))
        .slice(0, 3),
    }
  }

  /** Close the change is measured against: previous close for 1D, else the close on/before the start. */
  private referencePrice(
    instrumentId: string,
    lastDate: string,
    range: '1D' | '1W' | '1M' | '1Y',
    today: string,
  ): string | null {
    if (range === '1D') {
      return (
        this.db
          .select({ close: price.close })
          .from(price)
          .where(and(eq(price.instrumentId, instrumentId), lt(price.date, lastDate)))
          .orderBy(desc(price.date))
          .limit(1)
          .get()?.close ?? null
      )
    }
    const start = range === '1W' ? addDays(today, -7) : addMonths(today, range === '1M' ? -1 : -12)
    return (
      this.db
        .select({ close: price.close })
        .from(price)
        .where(and(eq(price.instrumentId, instrumentId), lte(price.date, start)))
        .orderBy(desc(price.date))
        .limit(1)
        .get()?.close ?? null
    )
  }
}
