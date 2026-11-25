import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ASSET_CLASSES,
  type AssetClass,
  type ChartPoint,
  type ChartRange,
  type QuoteDto,
  type SecurityHit,
  type SecuritySearchResponse,
} from '@finance/shared'
import { eq, inArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  dataSource,
  instrument,
  positionLot,
  price,
  quote,
  watchlistEntry,
} from '../../database/schema'
import { D } from '../../domain/money'
import { ScalableMcpClient, type TransportFactory } from '../sources/scalable-mcp/client'
import {
  SCALABLE_SOURCE_ID,
  ScalableCredentialStore,
} from '../sources/scalable-mcp/credential-store'
import { berlinDate } from '../sources/scalable-mcp/mapper'
import { ScalableOAuthProvider } from '../sources/scalable-mcp/oauth-provider'
import { payload, SCALABLE_TRANSPORT } from '../sources/scalable-mcp/scalable-mcp.source'

/** Hits per class group before "Mehr anzeigen". */
export const GROUP_SIZE = 10

/** Scalable security types → asset classes of the app; anything else is "Sonstige" (R6). */
const TYPE_TO_CLASS: Record<string, AssetClass> = {
  STOCK: 'stock',
  ETF: 'etf',
  ETP: 'etf',
  FUND: 'fund',
  BOND: 'bond',
  CRYPTO: 'crypto',
  COMMODITY: 'commodity',
}

/** Chart ranges of the app → Scalable timeframes (no 5-year timeframe exists). */
const TIMEFRAMES: Record<ChartRange, string> = {
  '1M': 'one_month',
  '6M': 'six_months',
  '1Y': 'one_year',
  MAX: 'max',
}

interface ScalableQuote {
  midPrice: number
  currency: string
  timestampUtc: string
  performances?: { timeframe: string; performance: number; simpleAbsoluteReturn: number }[]
}

/** Price as an EUR decimal string; undefined when missing or not positive. */
function decimal(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined
  return new D(value).toString()
}

/**
 * Security search, quotes and price history through the owner's Scalable connection
 * (005 US4, research R6). Only allowlisted read tools are called; without an active
 * connection search reports `available: false` and refresh is refused.
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name)
  private refreshing = false

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly store: ScalableCredentialStore,
    private readonly config: ConfigService,
    @Inject(SCALABLE_TRANSPORT) private readonly transport: TransportFactory,
  ) {}

  /** True when the Scalable source is connected. */
  available(): boolean {
    const row = this.db
      .select({ status: dataSource.status })
      .from(dataSource)
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .get()
    return row?.status === 'active'
  }

  get isRefreshing(): boolean {
    return this.refreshing
  }

  async search(query: string, assetClass?: AssetClass): Promise<SecuritySearchResponse> {
    if (!this.available()) return { available: false, groups: [] }
    const result = await this.withClient((client) =>
      client
        .call('search_securities', { query })
        .then((raw) =>
          payload<{ results?: { isin?: string; name?: string; securityType?: string }[] }>(raw),
        ),
    )
    const groups = new Map<AssetClass, SecurityHit[]>()
    const seen = new Set<string>()
    for (const item of result.results ?? []) {
      if (!item.isin || item.isin.length !== 12 || !item.name || seen.has(item.isin)) continue
      seen.add(item.isin)
      const hitClass = TYPE_TO_CLASS[item.securityType?.toUpperCase() ?? ''] ?? 'other'
      if (assetClass && hitClass !== assetClass) continue
      const list = groups.get(hitClass) ?? []
      list.push({ isin: item.isin, wkn: null, name: item.name, assetClass: hitClass })
      groups.set(hitClass, list)
    }
    return {
      available: true,
      groups: ASSET_CLASSES.filter((key) => groups.has(key)).map((key) => ({
        assetClass: key,
        hits: groups.get(key)!.slice(0, GROUP_SIZE),
        more: groups.get(key)!.length > GROUP_SIZE,
      })),
    }
  }

  quotes(ids: readonly string[]): QuoteDto[] {
    if (ids.length === 0) return []
    return this.db
      .select({
        instrumentId: quote.instrumentId,
        price: quote.price,
        changeAbs: quote.changeAbs,
        changePct: quote.changePct,
        quotedAt: quote.quotedAt,
      })
      .from(quote)
      .where(inArray(quote.instrumentId, [...ids]))
      .all()
  }

  /**
   * Fetches the latest quote of every watched or held security, stores it and today's price.
   * Returns the number of quotes stored; 409 without connection or while running.
   */
  async refresh(): Promise<number> {
    if (!this.available()) throw new ConflictException('Scalable ist nicht verbunden')
    if (this.refreshing) throw new ConflictException('Kurse werden bereits aktualisiert')
    this.refreshing = true
    try {
      const targets = this.targets()
      if (targets.length === 0) return 0
      return await this.withClient(async (client) => {
        let stored = 0
        for (const target of targets) {
          try {
            const { security } = payload<{ security?: { quote?: ScalableQuote } }>(
              await client.call('get_security_quote', { isin: target.isin }),
            )
            if (this.storeQuote(target.id, security?.quote)) stored++
          } catch (error) {
            this.logger.warn(
              `Quote for ${target.isin} failed: ${error instanceof Error ? error.message : error}`,
            )
          }
        }
        return stored
      })
    } finally {
      this.refreshing = false
    }
  }

  /** Daily closes for the chart (last point per day); also stored as prices. */
  async chart(instrumentId: string, range: ChartRange): Promise<ChartPoint[]> {
    const row = this.db.select().from(instrument).where(eq(instrument.id, instrumentId)).get()
    if (!row) throw new NotFoundException('Wertpapier nicht gefunden')
    if (!this.available()) return []
    const result = await this.withClient(async (client) =>
      payload<{ currency?: string; dataPoints?: { midPrice: number; timestampUtc: string }[] }>(
        await client.call('get_security_chart', { isin: row.isin, timeframe: TIMEFRAMES[range] }),
      ),
    )
    if ((result.currency ?? 'EUR').toUpperCase() !== 'EUR') return []
    const byDay = new Map<string, string>()
    for (const point of result.dataPoints ?? []) {
      const close = decimal(point.midPrice)
      if (close) byDay.set(berlinDate(point.timestampUtc), close)
    }
    const points = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, close]) => ({ date, close }))
    for (const point of points) {
      this.db
        .insert(price)
        .values({ instrumentId, date: point.date, close: point.close, source: 'scalable' })
        .onConflictDoUpdate({
          target: [price.instrumentId, price.date],
          set: { close: point.close, source: 'scalable' },
        })
        .run()
    }
    return points
  }

  /** Watched instruments plus instruments with open lots. */
  private targets(): { id: string; isin: string }[] {
    const watched = this.db
      .selectDistinct({ id: watchlistEntry.instrumentId })
      .from(watchlistEntry)
      .all()
    const held = this.db.selectDistinct({ id: positionLot.instrumentId }).from(positionLot).all()
    const ids = [...new Set([...watched, ...held].map((row) => row.id))]
    if (ids.length === 0) return []
    return this.db
      .select({ id: instrument.id, isin: instrument.isin })
      .from(instrument)
      .where(inArray(instrument.id, ids))
      .all()
  }

  /** Upserts the quote and today's price; false when the quote is unusable (not EUR, no price). */
  private storeQuote(instrumentId: string, data: ScalableQuote | undefined): boolean {
    const mid = decimal(data?.midPrice)
    if (!data || !mid || data.currency.toUpperCase() !== 'EUR') return false
    const intraday = data.performances?.find((item) => item.timeframe === 'INTRADAY')
    const values = {
      price: mid,
      changeAbs: intraday ? new D(intraday.simpleAbsoluteReturn).toString() : null,
      changePct: intraday ? new D(intraday.performance).toDecimalPlaces(6).toString() : null,
      quotedAt: data.timestampUtc,
      fetchedAt: new Date().toISOString(),
    }
    this.db
      .insert(quote)
      .values({ instrumentId, ...values })
      .onConflictDoUpdate({ target: quote.instrumentId, set: values })
      .run()
    this.db
      .insert(price)
      .values({ instrumentId, date: berlinDate(data.timestampUtc), close: mid, source: 'scalable' })
      .onConflictDoUpdate({
        target: [price.instrumentId, price.date],
        set: { close: mid, source: 'scalable' },
      })
      .run()
    return true
  }

  /** Opens one MCP connection for `run`; a lost grant reports "nicht verbunden". */
  private async withClient<T>(run: (client: ScalableMcpClient) => Promise<T>): Promise<T> {
    const client = new ScalableMcpClient(
      new URL(this.config.getOrThrow<string>('SCALABLE_MCP_URL')),
      new ScalableOAuthProvider(this.store, this.config.getOrThrow('SCALABLE_REDIRECT_URI')),
      this.transport,
    )
    try {
      const connected = await client.connect()
      if (connected.status !== 'connected') {
        throw new ConflictException('Scalable-Verbindung muss erneuert werden')
      }
      await client.discover()
      return await run(client)
    } finally {
      await client.close()
    }
  }
}
