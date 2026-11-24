import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { SourceKind, TransactionSource } from '@finance/shared'
import { desc, eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, dataSource, importJob, syncRun } from '../../database/schema'
import { ImportPipeline } from '../import/import.pipeline'
import { AuthExpiredError } from './errors'
import { SourcesRegistry } from './sources.registry'

/** Pull sources that can sync themselves; CSV is imported by upload only. */
const PULL_KINDS: ReadonlySet<SourceKind> = new Set(['scalable_mcp'])
const MAX_ERROR = 500

export interface SyncOutcome {
  runId: string
  status: 'succeeded' | 'partial' | 'failed'
  imported: number
  skipped: number
  error: string | null
}

/**
 * Runs pull syncs (004 US1, research R2): one at a time per source, logged in
 * `sync_run`, imported through the shared pipeline (fingerprint dedupe and
 * deleted-import markers apply), with the data-source status transitions
 * active → needs_reauth / error → active.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name)
  private readonly running = new Set<string>()

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly registry: SourcesRegistry,
    private readonly pipeline: ImportPipeline,
  ) {}

  canSync(sourceId: string): boolean {
    const row = this.source(sourceId)
    return PULL_KINDS.has(row.kind) && this.registry.has(row.kind)
  }

  isRunning(sourceId: string): boolean {
    return this.running.has(sourceId)
  }

  /** Starts a sync in the background; 409 while one runs or for non-pull sources. */
  start(sourceId: string): { runId: string; done: Promise<SyncOutcome> } {
    const runId = this.begin(sourceId)
    const done = this.execute(sourceId, runId)
    done.catch(() => undefined)
    return { runId, done }
  }

  /** Runs a sync to completion (scheduler, tests). */
  async run(sourceId: string): Promise<SyncOutcome> {
    return this.start(sourceId).done
  }

  private begin(sourceId: string): string {
    const row = this.source(sourceId)
    if (!PULL_KINDS.has(row.kind) || !this.registry.has(row.kind)) {
      throw new ConflictException('Diese Quelle wird per Import aktualisiert')
    }
    if (this.running.has(sourceId)) {
      throw new ConflictException('Synchronisierung läuft bereits')
    }
    this.running.add(sourceId)
    return this.db.insert(syncRun).values({ sourceId, status: 'running' }).returning().get().id
  }

  private async execute(sourceId: string, runId: string): Promise<SyncOutcome> {
    const row = this.source(sourceId)
    try {
      const batch = await this.registry
        .get(row.kind)
        .fetch({ kind: 'pull', since: row.lastSyncAt ?? undefined })
      const job = this.db
        .insert(importJob)
        .values({ sourceId, kind: 'sync', status: 'running' })
        .returning()
        .get()
      const result = this.pipeline.run(batch, {
        jobId: job.id,
        source: row.kind as TransactionSource,
        sourceId,
      })
      const status =
        result.status === 'failed'
          ? 'failed'
          : result.status === 'partial'
            ? 'partial'
            : 'succeeded'
      const now = new Date().toISOString()
      const error =
        status === 'failed' ? this.clip(result.errors[0]?.reason ?? 'Import fehlgeschlagen') : null
      this.db.transaction((tx) => {
        tx.update(syncRun)
          .set({
            status,
            finishedAt: now,
            imported: result.imported,
            skipped: result.skipped,
            error,
          })
          .where(eq(syncRun.id, runId))
          .run()
        tx.update(dataSource)
          .set(
            status === 'failed'
              ? { status: 'error', lastError: error }
              : { status: 'active', lastSyncAt: now, lastError: null },
          )
          .where(eq(dataSource.id, sourceId))
          .run()
        if (status !== 'failed') {
          tx.update(account).set({ lastSyncedAt: now }).where(eq(account.sourceId, sourceId)).run()
        }
      })
      return { runId, status, imported: result.imported, skipped: result.skipped, error }
    } catch (cause) {
      const expired = cause instanceof AuthExpiredError
      const error = this.clip(
        expired ? 'Anmeldung abgelaufen – bitte neu verbinden' : this.message(cause),
      )
      this.logger.warn(`Sync ${runId} for ${sourceId} failed: ${error}`)
      this.db.transaction((tx) => {
        tx.update(syncRun)
          .set({ status: 'failed', finishedAt: new Date().toISOString(), error })
          .where(eq(syncRun.id, runId))
          .run()
        tx.update(dataSource)
          .set({ status: expired ? 'needs_reauth' : 'error', lastError: error })
          .where(eq(dataSource.id, sourceId))
          .run()
      })
      return { runId, status: 'failed', imported: 0, skipped: 0, error }
    } finally {
      this.running.delete(sourceId)
    }
  }

  /** Latest run per source for `GET /api/sources`. */
  lastRun(sourceId: string) {
    return (
      this.db
        .select({
          status: syncRun.status,
          imported: syncRun.imported,
          skipped: syncRun.skipped,
          finishedAt: syncRun.finishedAt,
        })
        .from(syncRun)
        .where(eq(syncRun.sourceId, sourceId))
        .orderBy(desc(syncRun.startedAt))
        .limit(1)
        .get() ?? null
    )
  }

  private source(sourceId: string) {
    const row = this.db.select().from(dataSource).where(eq(dataSource.id, sourceId)).get()
    if (!row) throw new NotFoundException('Datenquelle nicht gefunden')
    return row
  }

  /** Error text without anything that looks like a token or key. */
  private message(cause: unknown): string {
    const text = cause instanceof Error ? cause.message : String(cause)
    return text.replace(/(bearer|token|code|secret)[=: ]+\S+/gi, '$1=…')
  }

  private clip(text: string): string {
    return text.length > MAX_ERROR ? `${text.slice(0, MAX_ERROR - 1)}…` : text
  }
}
