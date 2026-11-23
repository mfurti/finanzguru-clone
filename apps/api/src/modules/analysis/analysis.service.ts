import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import {
  type BreakdownQuery,
  type BreakdownResponse,
  type CompareResponse,
  CURRENCIES,
  DIMENSION_LABELS,
  type Period,
  RETURN_LABELS,
  type ReturnsResponse,
  UNASSIGNED_KEY,
  UNASSIGNED_LABEL,
  VOLATILITY_LABELS,
  type WeightDimension,
} from '@finance/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  customGroup,
  customGroupMember,
  inflationRate,
  instrument,
  instrumentWeight,
  owner,
  price,
} from '../../database/schema'
import { type Bucket, groupedBreakdown, weightedBreakdown } from '../../domain/breakdown'
import { ratio } from '../../domain/money'
import { todayIso } from '../../domain/period'
import { cumulativeTwror, monthlyReturns, yearlyReturns } from '../../domain/period-returns'
import type { ValuePoint } from '../../domain/returns'
import { annualizedVolatility, returnClass, volatilityClass } from '../../domain/volatility'
import { downsample, OverviewService } from '../overview/overview.service'
import {
  ASSET_CLASS_LABELS,
  type OpenHolding,
  PortfolioService,
} from '../overview/portfolio.service'

const DEFAULT_INFLATION = '0.0253'

/** Analyse page (US1): breakdowns, returns by month/year, depot comparison. */
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
    private readonly portfolio: PortfolioService,
  ) {}

  private depots(accounts?: readonly string[]) {
    return this.overview.resolveAccounts(accounts).filter((acc) => acc.type === 'depot')
  }

  breakdown(query: BreakdownQuery, today = todayIso()): BreakdownResponse {
    const holdings = this.portfolio.openHoldings(this.depots(query.accounts).map((d) => d.id))
    const totalCents = holdings.reduce((sum, h) => sum + h.valueCents, 0)
    const { buckets, label } = this.buckets(query, holdings, today)
    return {
      totalCents,
      buckets: buckets.map((bucket) => ({
        ...bucket,
        label: bucket.key === UNASSIGNED_KEY ? UNASSIGNED_LABEL : label(bucket.key),
        pct: ratio(bucket.valueCents, totalCents, 6),
      })),
    }
  }

  private buckets(
    query: BreakdownQuery,
    holdings: OpenHolding[],
    today: string,
  ): { buckets: Bucket[]; label: (key: string) => string } {
    switch (query.dimension) {
      case 'assetClass':
        return {
          buckets: groupedBreakdown(
            holdings.map((h) => ({ valueCents: h.valueCents, key: h.assetClass })),
          ),
          label: (key) => ASSET_CLASS_LABELS[key as keyof typeof ASSET_CLASS_LABELS] ?? key,
        }
      case 'region':
      case 'sector':
      case 'currency':
        return this.weighted(query.dimension, holdings)
      case 'volatility':
        return {
          buckets: groupedBreakdown(
            holdings.map((h) => ({
              valueCents: h.valueCents,
              key: volatilityClass(annualizedVolatility(this.closes(h.instrumentId), today)),
            })),
          ),
          label: (key) => VOLATILITY_LABELS[key as keyof typeof VOLATILITY_LABELS] ?? key,
        }
      case 'return':
        return {
          buckets: groupedBreakdown(
            holdings.map((h) => ({
              valueCents: h.valueCents,
              key: returnClass(ratio(h.valueCents - h.investedCents, h.investedCents)),
            })),
          ),
          label: (key) => RETURN_LABELS[key as keyof typeof RETURN_LABELS] ?? key,
        }
      case 'grouping':
        return this.grouping(query.groupingId, holdings)
    }
  }

  private weighted(dimension: WeightDimension, holdings: OpenHolding[]) {
    const ids = holdings.map((h) => h.instrumentId)
    const weights =
      ids.length === 0
        ? []
        : this.db
            .select()
            .from(instrumentWeight)
            .where(
              and(
                inArray(instrumentWeight.instrumentId, ids),
                eq(instrumentWeight.dimension, dimension),
              ),
            )
            .all()
    const currencies =
      dimension === 'currency' && ids.length > 0
        ? new Map(
            this.db
              .select({ id: instrument.id, currency: instrument.currency })
              .from(instrument)
              .where(inArray(instrument.id, ids))
              .all()
              .map((row) => [row.id, row.currency]),
          )
        : new Map<string, string>()
    const labels = DIMENSION_LABELS[dimension]
    return {
      buckets: weightedBreakdown(
        holdings.map((h) => {
          let own = weights
            .filter((w) => w.instrumentId === h.instrumentId)
            .map((w) => ({ key: w.key, weight: w.weight }))
          // Currency defaults to the instrument's trading currency (research R1).
          if (dimension === 'currency' && own.length === 0) {
            const code = currencies.get(h.instrumentId) ?? 'EUR'
            own = [
              {
                key: (CURRENCIES as readonly string[]).includes(code) ? code : 'OTHER',
                weight: '1',
              },
            ]
          }
          return { instrumentId: h.instrumentId, valueCents: h.valueCents, weights: own }
        }),
      ),
      label: (key: string) => labels[key] ?? key,
    }
  }

  private grouping(groupingId: string | undefined, holdings: OpenHolding[]) {
    if (!groupingId) throw new BadRequestException('Bitte eine eigene Aufteilung wählen')
    const groups = this.db
      .select()
      .from(customGroup)
      .where(eq(customGroup.groupingId, groupingId))
      .all()
    if (groups.length === 0) throw new BadRequestException('Aufteilung nicht gefunden')
    const members = new Map(
      this.db
        .select()
        .from(customGroupMember)
        .where(eq(customGroupMember.groupingId, groupingId))
        .all()
        .map((m) => [m.instrumentId, m.groupId]),
    )
    const names = new Map(groups.map((g) => [g.id, g.name]))
    return {
      buckets: groupedBreakdown(
        holdings.map((h) => ({
          valueCents: h.valueCents,
          key: members.get(h.instrumentId) ?? null,
        })),
      ),
      label: (key: string) => names.get(key) ?? key,
    }
  }

  private closes(instrumentId: string) {
    return this.db
      .select({ date: price.date, close: price.close })
      .from(price)
      .where(eq(price.instrumentId, instrumentId))
      .orderBy(asc(price.date))
      .all()
  }

  /** Depot value series with external flows (same basis as the KPI card). */
  private depotSeries(
    depots: ReturnType<AnalysisService['depots']>,
    range: { from: string; to: string },
  ): ValuePoint[] {
    return this.overview.dailyTotals(depots, range).map((point) => ({
      date: point.date,
      valueCents: point.depotValueCents,
      flowCents: point.depotFlowCents,
    }))
  }

  inflationFor(): (year: number) => string {
    const rates = new Map(
      this.db
        .select()
        .from(inflationRate)
        .all()
        .map((row) => [row.year, row.rate]),
    )
    const fallback =
      this.db.select({ rate: owner.inflationRate }).from(owner).get()?.rate ?? DEFAULT_INFLATION
    return (year) => rates.get(year) ?? fallback
  }

  /** Line for the selected period; months and years always over the full history. */
  returns(query: { accounts?: string[]; period: Period }, today = todayIso()): ReturnsResponse {
    const depots = this.depots(query.accounts)
    if (depots.length === 0) return { series: [], months: [], years: [] }
    const range = this.overview.range(depots, { period: query.period }, today)
    const full = this.overview.range(depots, { period: 'ALL' }, today)
    const all = this.depotSeries(depots, full)
    const series = this.depotSeries(depots, range)
    return {
      series: downsample(cumulativeTwror(series)),
      months: monthlyReturns(all),
      years: yearlyReturns(all, this.inflationFor(), today),
    }
  }

  /** TWROR lines per depot, rebased to 0 % on the first day all selected depots have data. */
  compare(query: { accounts?: string[]; period: Period }, today = todayIso()): CompareResponse {
    const depots = this.depots(query.accounts)
    if (depots.length === 0) return { series: [] }
    const names = new Map(
      this.db
        .select({ id: account.id, name: account.name })
        .from(account)
        .where(
          inArray(
            account.id,
            depots.map((d) => d.id),
          ),
        )
        .all()
        .map((row) => [row.id, row.name]),
    )
    const range = this.overview.range(depots, { period: query.period }, today)
    const starts = depots
      .map((d) => this.overview.firstSnapshotDate([d.id]))
      .filter((date): date is string => !!date)
    if (starts.length < depots.length) return { series: [] }
    const commonStart = [range.from, ...starts].sort().at(-1)!
    if (commonStart > range.to) return { series: [] }
    return {
      series: depots.map((depot) => ({
        accountId: depot.id,
        name: names.get(depot.id) ?? '',
        points: downsample(
          cumulativeTwror(this.depotSeries([depot], { from: commonStart, to: range.to })),
        ),
      })),
    }
  }
}
