import { BadRequestException, BadGatewayException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { ConnectResponse } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../../database/database.constants'
import type { AppDatabase } from '../../../database/drizzle.module'
import { dataSource } from '../../../database/schema'
import { UpstreamError } from '../errors'
import { httpTransport, ScalableMcpClient, type TransportFactory } from './client'
import { SCALABLE_SOURCE_ID, ScalableCredentialStore } from './credential-store'
import { ScalableOAuthProvider } from './oauth-provider'
import { SCALABLE_TRANSPORT } from './scalable-mcp.source'

export { SCALABLE_TRANSPORT } from './scalable-mcp.source'

/**
 * Connect / callback / disconnect for Scalable Capital (004 US1, research R1).
 * The owner logs in on Scalable's own page; the app keeps only the encrypted
 * grant and the tool manifest. Disconnecting deletes the grant, never data.
 */
@Injectable()
export class ScalableConnectionService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly store: ScalableCredentialStore,
    private readonly config: ConfigService,
    @Inject(SCALABLE_TRANSPORT) private readonly transport: TransportFactory = httpTransport,
  ) {}

  /** Returns Scalable's login URL, or `connected` when the stored grant still works. */
  async connect(): Promise<ConnectResponse> {
    this.store.ensureSource()
    const client = this.client()
    try {
      const result = await client.connect()
      if (result.status === 'authorization_required') {
        return { connected: false, authorizationUrl: result.authorizationUrl }
      }
      await this.activate(client)
      return { connected: true, authorizationUrl: null }
    } catch (error) {
      throw this.upstream(error)
    } finally {
      await client.close()
    }
  }

  /** Scalable redirected back: check state, exchange the code, verify the connection. */
  async callback(code: string | undefined, state: string | undefined): Promise<void> {
    if (!code || !this.provider().checkState(state)) {
      throw new BadRequestException('Ungültige Antwort von Scalable')
    }
    const client = this.client()
    try {
      await client.finishAuth(code)
      const result = await client.connect()
      if (result.status !== 'connected') throw new UpstreamError('Autorisierung unvollständig')
      await this.activate(client)
    } catch (error) {
      throw this.upstream(error)
    } finally {
      await client.close()
    }
  }

  /** Deletes the grant; imported accounts and bookings stay. */
  disconnect(): void {
    this.store.ensureSource()
    this.store.clear()
    this.db
      .update(dataSource)
      .set({ status: 'disabled', lastError: null, toolManifest: null })
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .run()
  }

  private async activate(client: ScalableMcpClient): Promise<void> {
    const manifest = await client.discover()
    this.db
      .update(dataSource)
      .set({ status: 'active', lastError: null, toolManifest: manifest })
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .run()
  }

  private provider(): ScalableOAuthProvider {
    return new ScalableOAuthProvider(this.store, this.config.getOrThrow('SCALABLE_REDIRECT_URI'))
  }

  private client(): ScalableMcpClient {
    return new ScalableMcpClient(
      new URL(this.config.getOrThrow<string>('SCALABLE_MCP_URL')),
      this.provider(),
      this.transport,
    )
  }

  private upstream(error: unknown): Error {
    if (error instanceof BadRequestException) return error
    return new BadGatewayException(
      error instanceof UpstreamError ? error.message : 'Scalable ist nicht erreichbar',
    )
  }
}
