import { Inject, Injectable } from '@nestjs/common'
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { OAuthDiscoveryState } from '@modelcontextprotocol/sdk/client/auth.js'
import { eq } from 'drizzle-orm'
import { CryptoService } from '../../../common/crypto.service'
import { DB } from '../../../database/database.constants'
import type { AppDatabase } from '../../../database/drizzle.module'
import { dataSource } from '../../../database/schema'

export const SCALABLE_SOURCE_ID = 'scalable_mcp'

/** Everything the OAuth flow needs to persist; stored AES-GCM encrypted (FR-061). */
export interface ScalableCredentials {
  clientInformation?: OAuthClientInformationMixed
  tokens?: OAuthTokens
  /** Epoch ms when the access token expires (derived from expires_in). */
  expiresAt?: number
  codeVerifier?: string
  state?: string
  discoveryState?: OAuthDiscoveryState
}

/** Reads and writes the encrypted credentials of the Scalable data source row. */
@Injectable()
export class ScalableCredentialStore {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly crypto: CryptoService,
  ) {}

  /** Creates the data source row on first use (status `disabled` until connected). */
  ensureSource(): void {
    this.db
      .insert(dataSource)
      .values({
        id: SCALABLE_SOURCE_ID,
        kind: 'scalable_mcp',
        status: 'disabled',
        displayName: 'Scalable Capital',
      })
      .onConflictDoNothing()
      .run()
  }

  load(): ScalableCredentials {
    const row = this.db
      .select({ encrypted: dataSource.encryptedCredentials })
      .from(dataSource)
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .get()
    if (!row?.encrypted) return {}
    return this.crypto.decryptJson<ScalableCredentials>(row.encrypted)
  }

  update(patch: Partial<ScalableCredentials>): ScalableCredentials {
    this.ensureSource()
    const next = { ...this.load(), ...patch }
    this.db
      .update(dataSource)
      .set({ encryptedCredentials: this.crypto.encryptJson(next) })
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .run()
    return next
  }

  clear(keys?: (keyof ScalableCredentials)[]): void {
    if (!keys) {
      this.db
        .update(dataSource)
        .set({ encryptedCredentials: null })
        .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
        .run()
      return
    }
    const remaining = Object.fromEntries(
      Object.entries(this.load()).filter(
        ([key]) => !keys.includes(key as keyof ScalableCredentials),
      ),
    )
    this.db
      .update(dataSource)
      .set({ encryptedCredentials: this.crypto.encryptJson(remaining) })
      .where(eq(dataSource.id, SCALABLE_SOURCE_ID))
      .run()
  }
}
