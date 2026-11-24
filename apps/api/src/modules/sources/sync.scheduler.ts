import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import { eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { dataSource } from '../../database/schema'
import { SCALABLE_SOURCE_ID } from './scalable-mcp/credential-store'
import { SyncService } from './sync.service'

/** Local time of the daily sync. */
export const DAILY_SYNC_HOUR = 6
const JOB = 'scalable-daily-sync'

/** Milliseconds from `now` to the next `hour:00` local time (tomorrow if already past). */
export function msUntilNext(hour: number, now = new Date()): number {
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

/**
 * Optional daily Scalable sync (004 T009, research R3). Off unless
 * SCALABLE_DAILY_SYNC=true; runs once a day at 06:00, only for an active
 * connection; missed runs (app was down) are not caught up.
 */
@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name)

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly sync: SyncService,
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (this.config.get<boolean>('SCALABLE_DAILY_SYNC')) this.schedule()
  }

  get scheduled(): boolean {
    return this.registry.doesExist('timeout', JOB)
  }

  schedule(now = new Date()): void {
    if (this.scheduled) this.registry.deleteTimeout(JOB)
    const timer = setTimeout(() => void this.tick(), msUntilNext(DAILY_SYNC_HOUR, now))
    timer.unref?.()
    this.registry.addTimeout(JOB, timer)
  }

  /** One daily run; always schedules the next one. */
  async tick(): Promise<'synced' | 'skipped' | 'failed'> {
    try {
      const row = this.db
        .select({ status: dataSource.status })
        .from(dataSource)
        .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
        .get()
      if (row?.status !== 'active' || !this.sync.canSync(SCALABLE_SOURCE_ID)) return 'skipped'
      if (this.sync.isRunning(SCALABLE_SOURCE_ID)) return 'skipped'
      const outcome = await this.sync.run(SCALABLE_SOURCE_ID)
      return outcome.status === 'failed' ? 'failed' : 'synced'
    } catch (error) {
      this.logger.warn(`Daily sync failed: ${error instanceof Error ? error.message : error}`)
      return 'failed'
    } finally {
      this.schedule()
    }
  }
}
