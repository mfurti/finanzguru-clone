import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SchedulerRegistry } from '@nestjs/schedule'
import { eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { dataSource } from '../../database/schema'
import { BANK_SOURCE_ID } from './enable-banking/enable-banking-connection.service'
import { SCALABLE_SOURCE_ID } from './scalable-mcp/credential-store'
import { SyncService } from './sync.service'

/** Local time of the daily sync. */
export const DAILY_SYNC_HOUR = 6
/** Daily jobs per pull source and the env flag that switches each on. */
const JOBS: Record<string, { flag: string; job: string }> = {
  [SCALABLE_SOURCE_ID]: { flag: 'SCALABLE_DAILY_SYNC', job: 'scalable-daily-sync' },
  [BANK_SOURCE_ID]: { flag: 'BANK_DAILY_SYNC', job: 'bank-daily-sync' },
}

/** Milliseconds from `now` to the next `hour:00` local time (tomorrow if already past). */
export function msUntilNext(hour: number, now = new Date()): number {
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

/**
 * Optional daily syncs (004 T009, research R3; bank 005 T012). Each is off unless its flag
 * (SCALABLE_DAILY_SYNC, BANK_DAILY_SYNC) is true; runs once a day at 06:00, only for an active
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
    for (const [sourceId, { flag }] of Object.entries(JOBS)) {
      if (this.config.get<boolean>(flag)) this.schedule(new Date(), sourceId)
    }
  }

  /** True when the Scalable job is scheduled. */
  get scheduled(): boolean {
    return this.isScheduled(SCALABLE_SOURCE_ID)
  }

  isScheduled(sourceId: string): boolean {
    return this.registry.doesExist('timeout', JOBS[sourceId]!.job)
  }

  schedule(now = new Date(), sourceId = SCALABLE_SOURCE_ID): void {
    const { job } = JOBS[sourceId]!
    if (this.isScheduled(sourceId)) this.registry.deleteTimeout(job)
    const timer = setTimeout(() => void this.tick(sourceId), msUntilNext(DAILY_SYNC_HOUR, now))
    timer.unref?.()
    this.registry.addTimeout(job, timer)
  }

  /** One daily run of `sourceId`; always schedules the next one. */
  async tick(sourceId = SCALABLE_SOURCE_ID): Promise<'synced' | 'skipped' | 'failed'> {
    try {
      const row = this.db
        .select({ status: dataSource.status })
        .from(dataSource)
        .where(eq(dataSource.id, sourceId))
        .get()
      if (row?.status !== 'active' || !this.sync.canSync(sourceId)) return 'skipped'
      if (this.sync.isRunning(sourceId)) return 'skipped'
      const outcome = await this.sync.run(sourceId)
      return outcome.status === 'failed' ? 'failed' : 'synced'
    } catch (error) {
      this.logger.warn(`Daily sync failed: ${error instanceof Error ? error.message : error}`)
      return 'failed'
    } finally {
      this.schedule(new Date(), sourceId)
    }
  }
}
