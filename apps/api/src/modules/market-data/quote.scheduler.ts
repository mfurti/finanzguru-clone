import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { MarketDataService } from './market-data.service'

/** Refresh interval during market hours (005 FR-015). */
export const QUOTE_INTERVAL_MS = 15 * 60 * 1000
const JOB = 'quote-refresh'

/** Mon–Fri 08:00–22:00 Europe/Berlin (spec Assumptions), independent of the server time zone. */
export function isMarketHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')!.value
  const hour = Number(parts.find((part) => part.type === 'hour')!.value)
  return !['Sat', 'Sun'].includes(weekday) && hour >= 8 && hour < 22
}

/**
 * Background quote refresh (005 T026): every 15 minutes during market hours, only while
 * Scalable is connected and no refresh is running. Quotes are read-only calls.
 */
@Injectable()
export class QuoteScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuoteScheduler.name)

  constructor(
    private readonly market: MarketDataService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return
    const timer = setInterval(() => void this.tick(), QUOTE_INTERVAL_MS)
    timer.unref?.()
    this.registry.addInterval(JOB, timer)
  }

  onModuleDestroy(): void {
    if (this.registry.doesExist('interval', JOB)) this.registry.deleteInterval(JOB)
  }

  async tick(now = new Date()): Promise<'refreshed' | 'skipped' | 'failed'> {
    if (!isMarketHours(now) || !this.market.available() || this.market.isRefreshing) {
      return 'skipped'
    }
    try {
      await this.market.refresh()
      return 'refreshed'
    } catch (error) {
      this.logger.warn(`Quote refresh failed: ${error instanceof Error ? error.message : error}`)
      return 'failed'
    }
  }
}
