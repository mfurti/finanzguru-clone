import { SchedulerRegistry } from '@nestjs/schedule'
import { describe, expect, it, vi } from 'vitest'
import type { MarketDataService } from '../../src/modules/market-data/market-data.service'
import { isMarketHours, QuoteScheduler } from '../../src/modules/market-data/quote.scheduler'

describe('quote scheduler (005 T026)', () => {
  it('knows the market hours in Berlin, also across daylight-saving changes', () => {
    // Winter (UTC+1): 07:30 UTC = 08:30 Berlin; 21:30 UTC = 22:30 Berlin.
    expect(isMarketHours(new Date('2026-11-25T07:30:00Z'))).toBe(true)
    expect(isMarketHours(new Date('2026-11-25T06:30:00Z'))).toBe(false)
    expect(isMarketHours(new Date('2026-11-25T21:30:00Z'))).toBe(false)
    // Summer (UTC+2): 06:30 UTC = 08:30 Berlin; 19:59 UTC = 21:59 Berlin.
    expect(isMarketHours(new Date('2026-07-01T06:30:00Z'))).toBe(true)
    expect(isMarketHours(new Date('2026-07-01T19:59:00Z'))).toBe(true)
    expect(isMarketHours(new Date('2026-07-01T20:00:00Z'))).toBe(false)
    // Weekend.
    expect(isMarketHours(new Date('2026-11-28T12:00:00Z'))).toBe(false)
  })

  const setup = (available: boolean, refreshing = false) => {
    const market = {
      available: () => available,
      isRefreshing: refreshing,
      refresh: vi.fn(async () => 3),
    } as unknown as MarketDataService
    return { market, scheduler: new QuoteScheduler(market, new SchedulerRegistry()) }
  }
  const open = new Date('2026-11-25T10:00:00Z')

  it('refreshes during market hours while Scalable is connected', async () => {
    const { market, scheduler } = setup(true)
    expect(await scheduler.tick(open)).toBe('refreshed')
    expect(market.refresh).toHaveBeenCalledOnce()
  })

  it('skips outside market hours, without connection, or while a refresh runs', async () => {
    expect(await setup(true).scheduler.tick(new Date('2026-11-28T10:00:00Z'))).toBe('skipped')
    expect(await setup(false).scheduler.tick(open)).toBe('skipped')
    const busy = setup(true, true)
    expect(await busy.scheduler.tick(open)).toBe('skipped')
    expect(busy.market.refresh).not.toHaveBeenCalled()
  })
})
