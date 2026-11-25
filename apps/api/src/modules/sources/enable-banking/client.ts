/**
 * Read-only client for the Enable Banking account-information API (005 R1).
 *
 * Every request carries a short-lived RS256 JWT signed with the owner's application key. Only
 * the method/path pairs in {@link ALLOWED_ENDPOINTS} can be called: payment endpoints and
 * anything else are refused before a request leaves the server (Constitution II).
 */
import { importPKCS8, SignJWT } from 'jose'
import { AuthExpiredError, ForbiddenToolError, UpstreamError } from '../errors'

/** Minimal fetch-like transport; tests replace it with recorded responses. */
export type EnableBankingHttp = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>

/** Injection token for the transport (faked in API e2e tests). */
export const ENABLE_BANKING_HTTP = Symbol('ENABLE_BANKING_HTTP')

export const fetchHttp: EnableBankingHttp = (url, init) => fetch(url, init)

/** The only calls the app may make; query strings are not part of the match. */
export const ALLOWED_ENDPOINTS: readonly { method: string; path: RegExp }[] = [
  { method: 'GET', path: /^\/aspsps$/ },
  { method: 'POST', path: /^\/auth$/ },
  { method: 'POST', path: /^\/sessions$/ },
  { method: 'GET', path: /^\/sessions\/[\w-]+$/ },
  { method: 'DELETE', path: /^\/sessions\/[\w-]+$/ },
  { method: 'GET', path: /^\/accounts\/[\w-]+\/(details|balances|transactions)$/ },
]

/** True when `method path` is on the read-only allowlist. */
export function isAllowedEndpoint(method: string, pathWithQuery: string): boolean {
  const path = pathWithQuery.split('?')[0]!
  return ALLOWED_ENDPOINTS.some((entry) => entry.method === method && entry.path.test(path))
}

/** Error codes that mean the consent is gone and the owner must connect again. */
const SESSION_GONE = new Set([
  'EXPIRED_SESSION',
  'CLOSED_SESSION',
  'REVOKED_SESSION',
  'SESSION_DOES_NOT_EXIST',
])

const MAX_ERROR = 500

/** Strips JWTs and ids from upstream messages and caps the length. */
export function sanitizeError(message: string): string {
  return message
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .slice(0, MAX_ERROR)
}

export interface Amount {
  amount: string
  currency: string
}

export interface Aspsp {
  name: string
  country: string
  logo?: string | null
  psu_types?: string[]
  maximum_consent_validity?: number
}

export interface SessionAccount {
  uid: string
  account_id?: { iban?: string | null } | null
  name?: string | null
  currency?: string | null
  product?: string | null
}

export interface SessionResponse {
  session_id: string
  accounts: SessionAccount[]
  aspsp: { name: string; country: string }
  access: { valid_until: string }
}

export interface Balance {
  name?: string | null
  balance_amount: Amount
  balance_type: string
  reference_date?: string | null
}

export interface BankTransaction {
  entry_reference?: string | null
  transaction_id?: string | null
  transaction_amount: Amount
  credit_debit_indicator: 'CRDT' | 'DBIT'
  status: string
  booking_date?: string | null
  value_date?: string | null
  transaction_date?: string | null
  creditor?: { name?: string | null } | null
  debtor?: { name?: string | null } | null
  creditor_account?: { iban?: string | null } | null
  debtor_account?: { iban?: string | null } | null
  remittance_information?: string[] | null
  /** Posting text and code, e.g. `{ description: "KARTENZAHLUNG" }`. */
  bank_transaction_code?: { description?: string | null; code?: string | null } | null
}

export interface TransactionsPage {
  transactions: BankTransaction[]
  continuation_key?: string | null
}

export interface EnableBankingClientOptions {
  appId: string
  /** PKCS#8 PEM of the application's private key. */
  privateKeyPem: string
  baseUrl: string
  http: EnableBankingHttp
  /** Clock for tests (epoch seconds). */
  now?: () => number
}

/** JWT lifetime in seconds; Enable Banking accepts up to 24 h, one hour is enough. */
const TOKEN_TTL = 3600

export class EnableBankingClient {
  constructor(private readonly options: EnableBankingClientOptions) {}

  /** Signed token for one request (`iss`/`aud` as required by Enable Banking). */
  async token(): Promise<string> {
    const now = this.options.now?.() ?? Math.floor(Date.now() / 1000)
    const key = await importPKCS8(this.options.privateKeyPem, 'RS256')
    return new SignJWT({})
      .setProtectedHeader({ typ: 'JWT', alg: 'RS256', kid: this.options.appId })
      .setIssuer('enablebanking.com')
      .setAudience('api.enablebanking.com')
      .setIssuedAt(now)
      .setExpirationTime(now + TOKEN_TTL)
      .sign(key)
  }

  aspsps(country: string): Promise<{ aspsps: Aspsp[] }> {
    return this.request('GET', `/aspsps?country=${encodeURIComponent(country)}&service=AIS`)
  }

  startAuth(input: {
    aspsp: { name: string; country: string }
    validUntil: string
    state: string
    redirectUrl: string
  }): Promise<{ url: string; authorization_id?: string }> {
    return this.request('POST', '/auth', {
      access: { valid_until: input.validUntil },
      aspsp: input.aspsp,
      state: input.state,
      redirect_url: input.redirectUrl,
      psu_type: 'personal',
    })
  }

  createSession(code: string): Promise<SessionResponse> {
    return this.request('POST', '/sessions', { code })
  }

  deleteSession(sessionId: string): Promise<unknown> {
    return this.request('DELETE', `/sessions/${encodeURIComponent(sessionId)}`)
  }

  accountDetails(uid: string): Promise<SessionAccount> {
    return this.request('GET', `/accounts/${encodeURIComponent(uid)}/details`)
  }

  balances(uid: string): Promise<{ balances: Balance[] }> {
    return this.request('GET', `/accounts/${encodeURIComponent(uid)}/balances`)
  }

  transactions(
    uid: string,
    query: { dateFrom: string; continuationKey?: string | null },
  ): Promise<TransactionsPage> {
    const params = new URLSearchParams({ date_from: query.dateFrom })
    if (query.continuationKey) params.set('continuation_key', query.continuationKey)
    return this.request('GET', `/accounts/${encodeURIComponent(uid)}/transactions?${params}`)
  }

  /** Allowlist check, signing, and error mapping for every call. */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!isAllowedEndpoint(method, path)) throw new ForbiddenToolError(`${method} ${path}`)
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.token()}`,
      Accept: 'application/json',
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    let response: Awaited<ReturnType<EnableBankingHttp>>
    try {
      response = await this.options.http(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      throw new UpstreamError(sanitizeError(`Enable Banking unreachable: ${String(error)}`))
    }
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      message?: string
    }
    if (response.status >= 200 && response.status < 300) return payload as T
    const code = payload.error ?? ''
    const message = sanitizeError(
      `Enable Banking ${response.status} ${code} ${payload.message ?? ''}`.trim(),
    )
    if (response.status === 401 || SESSION_GONE.has(code)) throw new AuthExpiredError(message)
    throw new UpstreamError(message)
  }
}
