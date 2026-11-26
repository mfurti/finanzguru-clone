import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { BenchmarkDto, BenchmarkSeries, ChartSettings, Period } from '@finance/shared'
import { asc, eq, inArray, max, min } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, price, userSetting } from '../../database/schema'
import { benchmarkSeries } from '../../domain/benchmark'
import { resolveRange, todayIso } from '../../domain/period'

const KEYS = {
  networthBenchmark: 'chart.networth.benchmark',
  investmentsBenchmark: 'chart.investments.benchmark',
} as const
const SHOW_INVESTED = 'chart.networth.showInvested'

/** "Vergleichen mit" (US5): benchmark instruments, their return series and chart choices. */
@Injectable()
export class BenchmarksService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  list(): BenchmarkDto[] {
    return this.db
      .select({
        instrumentId: instrument.id,
        name: instrument.name,
        isin: instrument.isin,
        firstDate: min(price.date),
        lastDate: max(price.date),
      })
      .from(instrument)
      .leftJoin(price, eq(price.instrumentId, instrument.id))
      .where(eq(instrument.isBenchmark, true))
      .groupBy(instrument.id)
      .orderBy(asc(instrument.name))
      .all()
  }

  series(
    instrumentId: string,
    query: { period: Period; from?: string; to?: string },
    today = todayIso(),
  ): BenchmarkSeries {
    const row = this.db.select().from(instrument).where(eq(instrument.id, instrumentId)).get()
    if (!row) throw new NotFoundException('Benchmark nicht gefunden')
    const prices = this.db
      .select({ date: price.date, close: price.close })
      .from(price)
      .where(eq(price.instrumentId, instrumentId))
      .orderBy(asc(price.date))
      .all()
    const range = resolveRange(query, today, prices[0]?.date)
    return benchmarkSeries(prices, range)
  }

  settings(): ChartSettings {
    const rows = new Map(
      this.db
        .select()
        .from(userSetting)
        .where(inArray(userSetting.key, [...Object.values(KEYS), SHOW_INVESTED]))
        .all()
        .map((r) => [r.key, r.value]),
    )
    return {
      networthBenchmark: rows.get(KEYS.networthBenchmark) ?? null,
      investmentsBenchmark: rows.get(KEYS.investmentsBenchmark) ?? null,
      networthShowInvested: rows.get(SHOW_INVESTED) !== 'false',
    }
  }

  setSettings(input: ChartSettings): ChartSettings {
    const ids = [input.networthBenchmark, input.investmentsBenchmark].filter(
      (id): id is string => !!id,
    )
    if (ids.length > 0) {
      const found = this.db
        .select({ id: instrument.id })
        .from(instrument)
        .where(inArray(instrument.id, ids))
        .all().length
      if (found !== new Set(ids).size) throw new BadRequestException('Benchmark nicht gefunden')
    }
    this.db.transaction((tx) => {
      for (const [field, key] of Object.entries(KEYS) as [keyof typeof KEYS, string][]) {
        tx.insert(userSetting)
          .values({ key, value: input[field] })
          .onConflictDoUpdate({ target: userSetting.key, set: { value: input[field] } })
          .run()
      }
      if (input.networthShowInvested !== undefined) {
        const value = String(input.networthShowInvested)
        tx.insert(userSetting)
          .values({ key: SHOW_INVESTED, value })
          .onConflictDoUpdate({ target: userSetting.key, set: { value } })
          .run()
      }
    })
    return this.settings()
  }
}
