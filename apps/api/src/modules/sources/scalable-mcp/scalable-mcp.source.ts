import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FetchInput, SourceStatus } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../../database/database.constants'
import type { AppDatabase } from '../../../database/drizzle.module'
import { dataSource } from '../../../database/schema'
import type { DataSource, SyncBatch } from '../data-source.interface'
import { AuthExpiredError, UpstreamError } from '../errors'
import { ScalableMcpClient, type TransportFactory } from './client'
import { SCALABLE_SOURCE_ID, ScalableCredentialStore } from './credential-store'
import {
  mapScalable,
  type PortfolioData,
  type ScalableCash,
  type ScalableHolding,
  type ScalablePortfolio,
  type ScalableTransaction,
} from './mapper'
import { ScalableOAuthProvider } from './oauth-provider'

/** Transport factory token; tests swap in an in-memory MCP server. */
export const SCALABLE_TRANSPORT = Symbol('SCALABLE_TRANSPORT')

/** Safety limit for transaction pages (100 each). */
const MAX_PAGES = 200

/** JSON payload of a tool result (first text content). */
export function payload<T>(result: unknown): T {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? []
  const text = content.find((item) => item.type === 'text')?.text
  if (!text) throw new UpstreamError('Leere Antwort von Scalable')
  const parsed = JSON.parse(text) as T & { error?: { code?: string; message?: string } }
  if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
    throw new UpstreamError(`Scalable: ${parsed.error.code ?? parsed.error.message ?? 'Fehler'}`)
  }
  return parsed
}

/**
 * Scalable Capital as a pull source (004 T007): portfolios, holdings, cash and
 * all transaction pages through the read-only allowlist, mapped to a SyncBatch.
 * Every call is a read tool; anything else is blocked before it is sent.
 */
@Injectable()
export class ScalableMcpSource implements DataSource {
  readonly kind = 'scalable_mcp' as const

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly store: ScalableCredentialStore,
    private readonly config: ConfigService,
    @Inject(SCALABLE_TRANSPORT) private readonly transport: TransportFactory,
  ) {}

  async status(): Promise<SourceStatus> {
    const row = this.db
      .select({ status: dataSource.status })
      .from(dataSource)
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .get()
    return row?.status ?? 'disabled'
  }

  async fetch(input: FetchInput): Promise<SyncBatch> {
    if (input.kind !== 'pull') throw new Error('Scalable is a pull source')
    const client = new ScalableMcpClient(
      new URL(this.config.getOrThrow<string>('SCALABLE_MCP_URL')),
      new ScalableOAuthProvider(this.store, this.config.getOrThrow('SCALABLE_REDIRECT_URI')),
      this.transport,
    )
    try {
      const connected = await client.connect()
      if (connected.status !== 'connected') {
        // The grant is gone: the sync service turns this into `needs_reauth`.
        throw new AuthExpiredError()
      }
      await client.discover()
      const { portfolios } = payload<{ portfolios: ScalablePortfolio[] }>(
        await client.call('list_accessible_portfolios'),
      )
      const data: PortfolioData[] = []
      for (const portfolio of portfolios) {
        const args = { portfolioId: portfolio.portfolioId }
        const holdings = payload<{ holdings: ScalableHolding[] }>(
          await client.call('get_portfolio_holdings', args),
        ).holdings
        const cash = payload<ScalableCash>(await client.call('get_portfolio_cash_breakdown', args))
        data.push({
          portfolio,
          holdings,
          cash,
          transactions: await this.allTransactions(client, portfolio.portfolioId),
        })
      }
      return mapScalable(data)
    } finally {
      await client.close()
    }
  }

  /** Every page of `list_portfolio_transactions` (full history; dedupe skips known ones). */
  private async allTransactions(
    client: ScalableMcpClient,
    portfolioId: string,
  ): Promise<ScalableTransaction[]> {
    const all: ScalableTransaction[] = []
    let cursor: string | undefined
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = payload<{
        transactions: ScalableTransaction[]
        page?: { nextCursor?: string | null }
      }>(
        await client.call('list_portfolio_transactions', {
          portfolioId,
          pageSize: 100,
          ...(cursor ? { cursor } : {}),
        }),
      )
      all.push(...result.transactions)
      cursor = result.page?.nextCursor ?? undefined
      if (!cursor) return all
    }
    throw new UpstreamError('Zu viele Seiten von Scalable')
  }
}
