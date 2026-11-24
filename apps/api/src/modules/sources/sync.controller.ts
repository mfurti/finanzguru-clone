import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import type { ConnectResponse, DataSourceDto, SyncStarted } from '@finance/shared'
import { asc, eq } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { dataSource } from '../../database/schema'
import { SCALABLE_SOURCE_ID } from './scalable-mcp/credential-store'
import { ScalableConnectionService } from './scalable-mcp/scalable-connection.service'
import { SyncService } from './sync.service'

/** Data sources with sync state, Scalable connection and manual sync (004 US1). */
@ApiTags('sources')
@Controller('sources')
export class SyncController {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly sync: SyncService,
    private readonly scalable: ScalableConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** Configured data sources; credentials are never part of the response. */
  @Get()
  list(): DataSourceDto[] {
    const daily = this.config.get<boolean>('SCALABLE_DAILY_SYNC') ?? false
    return this.db
      .select({
        id: dataSource.id,
        kind: dataSource.kind,
        status: dataSource.status,
        displayName: dataSource.displayName,
        lastSyncAt: dataSource.lastSyncAt,
        lastError: dataSource.lastError,
      })
      .from(dataSource)
      .orderBy(asc(dataSource.displayName))
      .all()
      .map((row) => ({
        ...row,
        lastRun: this.sync.lastRun(row.id),
        ...(row.kind === 'scalable_mcp' ? { dailySync: daily } : {}),
      }))
  }

  /** Scalable's login page (owner logs in there), or `connected` when the grant still works. */
  @Post('scalable/connect')
  @HttpCode(HttpStatus.OK)
  connect(): Promise<ConnectResponse> {
    return this.scalable.connect()
  }

  /** Redirect target of Scalable's login; back to the settings page either way. */
  @Get('scalable/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') description: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Scalable refused (e.g. "Agentic Investing" not enabled): say why, no exchange attempt.
    if (error) {
      const reason = /agentic investing/i.test(description ?? '') ? 'agentic' : 'denied'
      await reply.redirect(`/settings/sources?error=scalable&reason=${reason}`, 302)
      return
    }
    try {
      await this.scalable.callback(code, state)
      await reply.redirect('/settings/sources?connected=scalable', 302)
    } catch {
      await reply.redirect('/settings/sources?error=scalable', 302)
    }
  }

  /** 202 with the run id; 409 while running or for CSV sources. */
  @Post(':id/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  start(@Param('id') id: string): SyncStarted {
    return { runId: this.sync.start(id).runId }
  }

  /** Disconnect: deletes the grant, keeps every imported account and booking. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    const row = this.db.select().from(dataSource).where(eq(dataSource.id, id)).get()
    if (!row) throw new NotFoundException('Datenquelle nicht gefunden')
    if (id !== SCALABLE_SOURCE_ID) throw new NotFoundException('Nur Scalable kann getrennt werden')
    this.scalable.disconnect()
  }
}
