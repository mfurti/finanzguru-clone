import { SchedulerRegistry } from '@nestjs/schedule'
import { describe, expect, it, vi } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { dataSource } from '../../src/database/schema'
import { msUntilNext, SyncScheduler } from '../../src/modules/sources/sync.scheduler'
import type { SyncService } from '../../src/modules/sources/sync.service'
import { createTestDb } from '../helpers/test-db'

const config = (daily: boolean) => ({ get: () => daily }) as never

function setup(status: 'active' | 'needs_reauth', daily = true) {
  const db: AppDatabase = createTestDb()
  db.insert(dataSource)
    .values({ id: 'scalable_mcp', kind: 'scalable_mcp', status, displayName: 'Scalable' })
    .run()
  const sync = {
    canSync: () => true,
    isRunning: () => false,
    run: vi.fn(async () => ({ status: 'succeeded' })),
  } as unknown as SyncService
  const registry = new SchedulerRegistry()
  const scheduler = new SyncScheduler(db, sync, config(daily), registry)
  return { scheduler, sync, registry }
}

describe('daily sync scheduler (004 T009)', () => {
  it('computes the time until the next 06:00', () => {
    expect(msUntilNext(6, new Date(2026, 10, 24, 5, 30))).toBe(30 * 60_000)
    expect(msUntilNext(6, new Date(2026, 10, 24, 6, 0))).toBe(24 * 3_600_000)
    expect(msUntilNext(6, new Date(2026, 10, 24, 22, 0))).toBe(8 * 3_600_000)
  })

  it('is off unless SCALABLE_DAILY_SYNC is set', () => {
    const off = setup('active', false)
    off.scheduler.onModuleInit()
    expect(off.scheduler.scheduled).toBe(false)
    const on = setup('active', true)
    on.scheduler.onModuleInit()
    expect(on.scheduler.scheduled).toBe(true)
    on.registry.deleteTimeout('scalable-daily-sync')
  })

  it('syncs an active connection and reschedules', async () => {
    const { scheduler, sync, registry } = setup('active')
    expect(await scheduler.tick()).toBe('synced')
    expect(sync.run).toHaveBeenCalledWith('scalable_mcp')
    expect(scheduler.scheduled).toBe(true)
    registry.deleteTimeout('scalable-daily-sync')
  })

  it('skips a connection that needs re-authorization', async () => {
    const { scheduler, sync, registry } = setup('needs_reauth')
    expect(await scheduler.tick()).toBe('skipped')
    expect(sync.run).not.toHaveBeenCalled()
    registry.deleteTimeout('scalable-daily-sync')
  })
})
