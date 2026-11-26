import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { CryptoService } from '../../src/common/crypto.service'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { dataSource } from '../../src/database/schema'
import {
  SCALABLE_SOURCE_ID,
  ScalableCredentialStore,
} from '../../src/modules/sources/scalable-mcp/credential-store'
import { ScalableOAuthProvider } from '../../src/modules/sources/scalable-mcp/oauth-provider'
import { createTestDb } from '../helpers/test-db'

const REDIRECT = 'http://localhost:3000/api/sources/scalable/callback'

describe('ScalableOAuthProvider', () => {
  let db: AppDatabase
  let store: ScalableCredentialStore
  let provider: ScalableOAuthProvider

  beforeEach(() => {
    db = createTestDb()
    const crypto = new CryptoService(
      new ConfigService({ API_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') }),
    )
    store = new ScalableCredentialStore(db, crypto)
    provider = new ScalableOAuthProvider(store, REDIRECT)
  })

  it('registers as a public client with the configured redirect URI', () => {
    expect(provider.redirectUrl).toBe(REDIRECT)
    expect(provider.clientMetadata).toMatchObject({
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
    })
  })

  it('stores client information, tokens and verifier encrypted', () => {
    provider.saveClientInformation({ client_id: 'client-123' })
    provider.saveCodeVerifier('verifier-abc')
    provider.saveTokens({ access_token: 'secret-access', token_type: 'Bearer', expires_in: 3600 })

    expect(provider.clientInformation()).toEqual({ client_id: 'client-123' })
    expect(provider.codeVerifier()).toBe('verifier-abc')
    expect(provider.tokens()?.access_token).toBe('secret-access')
    expect(store.load().expiresAt).toBeGreaterThan(Date.now())

    const raw = db.select().from(dataSource).where(eq(dataSource.id, SCALABLE_SOURCE_ID)).get()!
    expect(raw.encryptedCredentials).toBeInstanceOf(Buffer)
    expect(raw.encryptedCredentials!.toString('latin1')).not.toContain('secret-access')
    expect(raw.status).toBe('disabled')
  })

  it('captures the authorization URL instead of redirecting', () => {
    const url = new URL('https://auth.example/authorize?client_id=x')
    provider.redirectToAuthorization(url)
    expect(provider.pendingAuthorizationUrl).toBe(url)
  })

  it('creates a fresh state and checks it in the callback', () => {
    const state = provider.state()
    expect(state).toHaveLength(32)
    expect(provider.checkState(state)).toBe(true)
    expect(provider.checkState('forged')).toBe(false)
    expect(provider.checkState(undefined)).toBe(false)
  })

  it('invalidates selected credentials', () => {
    provider.saveClientInformation({ client_id: 'c' })
    provider.saveTokens({ access_token: 'a', token_type: 'Bearer' })
    provider.invalidateCredentials('tokens')
    expect(provider.tokens()).toBeUndefined()
    expect(provider.clientInformation()).toEqual({ client_id: 'c' })
    provider.invalidateCredentials('all')
    expect(provider.clientInformation()).toBeUndefined()
  })

  it('fails loudly without a stored verifier', () => {
    expect(() => provider.codeVerifier()).toThrow(/verifier/)
  })
})
