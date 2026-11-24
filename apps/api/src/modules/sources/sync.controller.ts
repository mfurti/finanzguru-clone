import {
  Body,
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
import {
  bankConnectRequest,
  type BankConnectResponse,
  type BankInstitution,
  type ConnectResponse,
  type DataSourceDto,
  type SyncStarted,
} from '@finance/shared'
import { asc, eq } from 'drizzle-orm'
import { createZodDto } from 'nestjs-zod'
import type { FastifyReply } from 'fastify'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, dataSource } from '../../database/schema'
import { maskIban } from '../../domain/sparkline'
import {
  BANK_SOURCE_ID,
  BankCallbackError,
  EnableBankingConnectionService,
} from './enable-banking/enable-banking-connection.service'
import { SCALABLE_SOURCE_ID } from './scalable-mcp/credential-store'
import { ScalableConnectionService } from './scalable-mcp/scalable-connection.service'
import { SyncService } from './sync.service'

class BankConnectDto extends createZodDto(bankConnectRequest) {}

/** Days before the consent end from which the app warns (005 R4). */
export const CONSENT_WARNING_DAYS = 14

/**
 * Data sources with sync state, the Scalable connection and manual sync (004 US1), and the
 * bank connection through Enable Banking (005 US1).
 */
@ApiTags('sources')
@Controller('sources')
export class SyncController {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly sync: SyncService,
    private readonly scalable: ScalableConnectionService,
    private readonly bank: EnableBankingConnectionService,
    private readonly config: ConfigService,
  ) {}

  /** Configured data sources; credentials are never part of the response. */
  @Get()
  list(): DataSourceDto[] {
    const daily = this.config.get<boolean>('SCALABLE_DAILY_SYNC') ?? false
    const bankDaily = this.config.get<boolean>('BANK_DAILY_SYNC') ?? false
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
        ...(row.kind === 'enable_banking' ? { dailySync: bankDaily, ...this.bankState() } : {}),
      }))
  }

  /** Consent end, warning flag, bank name and linked accounts of the bank source. */
  private bankState(): Pick<
    DataSourceDto,
    'consentEndsAt' | 'consentWarning' | 'institution' | 'accounts'
  > {
    const consent = this.bank.consent()
    const endsAt = consent?.validUntil ?? null
    const warning =
      !!endsAt && new Date(endsAt).getTime() - Date.now() <= CONSENT_WARNING_DAYS * 86_400_000
    const accounts = this.db
      .select({ id: account.id, name: account.name, iban: account.iban })
      .from(account)
      .where(eq(account.sourceId, BANK_SOURCE_ID))
      .orderBy(asc(account.name))
      .all()
      .map((row) => ({ id: row.id, name: row.name, maskedIban: maskIban(row.iban) }))
    return {
      consentEndsAt: endsAt,
      consentWarning: warning,
      institution: consent?.aspspName ?? null,
      accounts,
    }
  }

  /** Banks offering account information (Enable Banking list); 503 when not configured. */
  @Get('bank/institutions')
  institutions(@Query('country') country = 'DE'): Promise<BankInstitution[]> {
    return this.bank.institutions(country.slice(0, 2).toUpperCase())
  }

  /** Starts the login at the chosen bank; the browser goes to the returned page. */
  @Post('bank/connect')
  @HttpCode(HttpStatus.OK)
  connectBank(@Body() body: BankConnectDto): Promise<BankConnectResponse> {
    return this.bank.connect({ name: body.aspspName, country: body.aspspCountry })
  }

  /** Redirect target after the bank login; back to the settings page either way. */
  @Get('bank/callback')
  async bankCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (error) {
      await reply.redirect('/settings/sources?error=bank&reason=denied', 302)
      return
    }
    try {
      await this.bank.callback(code, state)
      await reply.redirect('/settings/sources?connected=bank', 302)
    } catch (cause) {
      const reason = cause instanceof BankCallbackError ? `&reason=${cause.reason}` : ''
      await reply.redirect(`/settings/sources?error=bank${reason}`, 302)
    }
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
  async remove(@Param('id') id: string): Promise<void> {
    const row = this.db.select().from(dataSource).where(eq(dataSource.id, id)).get()
    if (!row) throw new NotFoundException('Datenquelle nicht gefunden')
    if (id === SCALABLE_SOURCE_ID) return this.scalable.disconnect()
    if (id === BANK_SOURCE_ID) return this.bank.disconnect()
    throw new NotFoundException('Diese Quelle kann nicht getrennt werden')
  }
}
