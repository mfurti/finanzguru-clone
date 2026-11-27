import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { OwnerSettings, OwnerSettingsPatch } from '@finance/shared'
import { SchedulerRegistry } from '@nestjs/schedule'
import { nextRefreshDelay } from '../../domain/refresh-schedule'
import { SettingsService } from '../settings/settings.service'
import { RefreshService } from './refresh.service'

const JOB = 'auto-refresh'

/**
 * Automatic refresh (014 US1): runs the 013 "Aktualisieren" for all sources on the owner's
 * schedule (off, daily at HH:MM, every n hours) and re-plans when the setting changes.
 * Missed runs (app was down) are not caught up.
 */
@Injectable()
export class RefreshScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshScheduler.name)
  private readonly onChange = (settings: OwnerSettings, patch: OwnerSettingsPatch) => {
    if (patch.refreshSchedule) this.plan(settings)
  }

  constructor(
    private readonly settings: SettingsService,
    private readonly refresh: RefreshService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.settings.events.on('change', this.onChange)
    this.plan(this.settings.get())
  }

  onModuleDestroy(): void {
    this.settings.events.off('change', this.onChange)
    this.clear()
  }

  /** True while a next run is planned. */
  get scheduled(): boolean {
    return this.registry.doesExist('timeout', JOB)
  }

  plan(settings = this.settings.get(), now = new Date()): void {
    this.clear()
    const delay = nextRefreshDelay(settings.refreshSchedule, now)
    if (delay === null) return
    const timer = setTimeout(() => void this.tick(), delay)
    timer.unref?.()
    this.registry.addTimeout(JOB, timer)
  }

  /** One automatic run; always plans the next one. */
  async tick(): Promise<void> {
    try {
      const results = await this.refresh.refreshAll()
      const failed = results.filter((result) => !result.ok).length
      if (failed > 0)
        this.logger.warn(`Automatische Aktualisierung: ${failed} Quelle(n) fehlgeschlagen`)
    } catch (error) {
      this.logger.warn(
        `Automatische Aktualisierung fehlgeschlagen: ${error instanceof Error ? error.message : error}`,
      )
    } finally {
      this.plan()
    }
  }

  private clear(): void {
    if (this.scheduled) this.registry.deleteTimeout(JOB)
  }
}
