import { randomBytes } from 'node:crypto'
import type {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import type { ScalableCredentialStore } from './credential-store'

/**
 * OAuth client for Scalable's MCP server (authorization code + PKCE with
 * dynamic client registration). Tokens, client registration, PKCE verifier
 * and state are kept server-side, encrypted. The owner logs in personally on
 * Scalable's own page; the app never sees the Scalable password (FR-053).
 */
export class ScalableOAuthProvider implements OAuthClientProvider {
  /** Set when the SDK wants the user to log in; returned by the connect endpoint. */
  pendingAuthorizationUrl: URL | null = null

  constructor(
    private readonly store: ScalableCredentialStore,
    private readonly redirectUri: string,
  ) {}

  get redirectUrl(): string {
    return this.redirectUri
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'Vermögenskompass (self-hosted)',
      redirect_uris: [this.redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }
  }

  /** New random state per authorization; checked again in the callback. */
  state(): string {
    const state = randomBytes(24).toString('base64url')
    this.store.update({ state })
    return state
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this.store.load().clientInformation
  }

  saveClientInformation(clientInformation: OAuthClientInformationMixed): void {
    this.store.update({ clientInformation })
  }

  tokens(): OAuthTokens | undefined {
    return this.store.load().tokens
  }

  saveTokens(tokens: OAuthTokens): void {
    const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined
    this.store.update({ tokens, expiresAt })
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this.pendingAuthorizationUrl = authorizationUrl
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.store.update({ codeVerifier })
  }

  codeVerifier(): string {
    const verifier = this.store.load().codeVerifier
    if (!verifier) throw new Error('No PKCE code verifier stored')
    return verifier
  }

  saveDiscoveryState(discoveryState: OAuthDiscoveryState): void {
    this.store.update({ discoveryState })
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.store.load().discoveryState
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void {
    const keys = {
      all: undefined,
      client: ['clientInformation'],
      tokens: ['tokens', 'expiresAt'],
      verifier: ['codeVerifier'],
      discovery: ['discoveryState'],
    } as const
    const selected = keys[scope]
    this.store.clear(selected ? [...selected] : undefined)
  }

  /** True if the callback's state matches the one sent with the authorization request. */
  checkState(state: string | undefined): boolean {
    const expected = this.store.load().state
    return !!state && !!expected && state === expected
  }
}
