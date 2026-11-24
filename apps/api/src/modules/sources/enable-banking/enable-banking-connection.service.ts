import { readFileSync } from 'node:fs'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { BankConnectResponse, BankInstitution } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { CryptoService } from '../../../common/crypto.service'
import { DB } from '../../../database/database.constants'
import type { AppDatabase } from '../../../database/drizzle.module'
import { bankConsent, dataSource } from '../../../database/schema'
import { AuthExpiredError, UpstreamError } from '../errors'
import { ENABLE_BANKING_HTTP, EnableBankingClient, type EnableBankingHttp } from './client'

export const BANK_SOURCE_ID = 'enable_banking'

/** Consent lifetime requested at the bank (research R4); shortened to the bank's maximum. */
const CONSENT_DAYS = 90
/** How long a started login may take before its `state` is no longer accepted. */
const STATE_TTL_MS = 30 * 60 * 1000

/** Stored AES-GCM encrypted in `data_source.encrypted_credentials`; never returned by the API. */
export interface BankCredentials {
  sessionId?: string
  accountUids?: string[]
  state?: string
  stateExpiresAt?: number
  pendingAspsp?: { name: string; country: string }
}

/** Why a callback was refused; the controller turns it into `?reason=…`. */
export class BankCallbackError extends BadRequestException {
  constructor(readonly reason: 'state' | 'expired' | 'denied') {
    super(`Bank callback refused: ${reason}`)
  }
}

/**
 * Connect / callback / disconnect for the owner's bank through Enable Banking (005 US1, R1).
 * The owner logs in and approves access on the bank's own page; the app stores only the
 * encrypted session id and the approved account ids. Disconnecting deletes the access, never data.
 */
@Injectable()
export class EnableBankingConnectionService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    @Inject(ENABLE_BANKING_HTTP) private readonly http: EnableBankingHttp,
  ) {}

  /** True when the owner has set the application id and key file. */
  configured(): boolean {
    return (
      !!this.config.get('ENABLE_BANKING_APP_ID') && !!this.config.get('ENABLE_BANKING_KEY_FILE')
    )
  }

  /** Banks offering account information in `country`. */
  async institutions(country: string): Promise<BankInstitution[]> {
    const { aspsps } = await this.call(() => this.client().aspsps(country))
    return aspsps
      .filter((item) => !item.psu_types || item.psu_types.includes('personal'))
      .map((item) => ({ name: item.name, country: item.country, logo: item.logo ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }

  /** Starts the login at the bank; returns the page the browser goes to. */
  async connect(aspsp: { name: string; country: string }): Promise<BankConnectResponse> {
    this.ensureSource()
    const client = this.client()
    const { aspsps } = await this.call(() => client.aspsps(aspsp.country))
    const bank = aspsps.find((item) => item.name === aspsp.name)
    if (!bank) throw new BadRequestException('Unbekannte Bank')
    const maxSeconds = bank.maximum_consent_validity ?? CONSENT_DAYS * 86400
    const seconds = Math.min(CONSENT_DAYS * 86400, maxSeconds)
    const validUntil = new Date(Date.now() + seconds * 1000).toISOString()
    const state = randomBytes(24).toString('hex')
    this.update({
      state,
      stateExpiresAt: Date.now() + STATE_TTL_MS,
      pendingAspsp: { name: bank.name, country: bank.country },
    })
    const result = await this.call(() =>
      client.startAuth({
        aspsp: { name: bank.name, country: bank.country },
        validUntil,
        state,
        redirectUrl: this.config.getOrThrow<string>('ENABLE_BANKING_REDIRECT_URL'),
      }),
    )
    return { authorizationUrl: result.url }
  }

  /** The bank redirected back: check `state`, create the session, store the consent. */
  async callback(code: string | undefined, state: string | undefined): Promise<void> {
    const stored = this.load()
    if (!code || !state || !stored.state || !sameText(state, stored.state)) {
      throw new BankCallbackError('state')
    }
    if (!stored.stateExpiresAt || stored.stateExpiresAt < Date.now()) {
      throw new BankCallbackError('expired')
    }
    const session = await this.call(() => this.client().createSession(code))
    // A renewal replaces the old session; close it at the bank so only one stays open.
    if (stored.sessionId && stored.sessionId !== session.session_id) {
      await this.client()
        .deleteSession(stored.sessionId)
        .catch(() => undefined)
    }
    this.save({
      sessionId: session.session_id,
      accountUids: session.accounts.map((item) => item.uid),
    })
    const consent = {
      aspspName: session.aspsp?.name ?? stored.pendingAspsp?.name ?? 'Bank',
      aspspCountry: (session.aspsp?.country ?? stored.pendingAspsp?.country ?? 'DE').toUpperCase(),
      validUntil: session.access.valid_until,
    }
    this.db
      .insert(bankConsent)
      .values({ sourceId: BANK_SOURCE_ID, ...consent })
      .onConflictDoUpdate({ target: bankConsent.sourceId, set: consent })
      .run()
    this.db
      .update(dataSource)
      .set({ status: 'active', lastError: null, displayName: consent.aspspName })
      .where(eq(dataSource.id, BANK_SOURCE_ID))
      .run()
  }

  /** Deletes the access at Enable Banking (best effort) and locally; data stays. */
  async disconnect(): Promise<void> {
    this.ensureSource()
    const { sessionId } = this.load()
    if (sessionId && this.configured()) {
      await this.client()
        .deleteSession(sessionId)
        .catch(() => undefined)
    }
    this.db
      .update(dataSource)
      .set({ encryptedCredentials: null, status: 'disabled', lastError: null })
      .where(eq(dataSource.id, BANK_SOURCE_ID))
      .run()
    this.db.delete(bankConsent).where(eq(bankConsent.sourceId, BANK_SOURCE_ID)).run()
  }

  /** The consent ended at the bank: stop syncing until the owner renews it. */
  markExpired(message: string): void {
    this.db
      .update(dataSource)
      .set({ status: 'consent_expired', lastError: message.slice(0, 500) })
      .where(eq(dataSource.id, BANK_SOURCE_ID))
      .run()
  }

  consent(): typeof bankConsent.$inferSelect | undefined {
    return this.db.select().from(bankConsent).where(eq(bankConsent.sourceId, BANK_SOURCE_ID)).get()
  }

  /** Stored session for a sync; undefined when not connected. */
  session(): { sessionId: string; accountUids: string[] } | undefined {
    const stored = this.load()
    if (!stored.sessionId) return undefined
    return { sessionId: stored.sessionId, accountUids: stored.accountUids ?? [] }
  }

  /** Signed client for the configured application; 503 when it is not configured. */
  client(): EnableBankingClient {
    const appId = this.config.get<string>('ENABLE_BANKING_APP_ID')
    const keyFile = this.config.get<string>('ENABLE_BANKING_KEY_FILE')
    if (!appId || !keyFile) {
      throw new ServiceUnavailableException('Enable Banking ist nicht konfiguriert')
    }
    let privateKeyPem: string
    try {
      privateKeyPem = readFileSync(keyFile, 'utf8')
    } catch {
      throw new ServiceUnavailableException('Schlüsseldatei für Enable Banking nicht lesbar')
    }
    return new EnableBankingClient({
      appId,
      privateKeyPem,
      baseUrl: this.config.getOrThrow<string>('ENABLE_BANKING_API_URL'),
      http: this.http,
    })
  }

  ensureSource(): void {
    this.db
      .insert(dataSource)
      .values({
        id: BANK_SOURCE_ID,
        kind: 'enable_banking',
        status: 'disabled',
        displayName: 'Bankkonto',
      })
      .onConflictDoNothing()
      .run()
  }

  private load(): BankCredentials {
    const row = this.db
      .select({ encrypted: dataSource.encryptedCredentials })
      .from(dataSource)
      .where(eq(dataSource.id, BANK_SOURCE_ID))
      .get()
    return row?.encrypted ? this.crypto.decryptJson<BankCredentials>(row.encrypted) : {}
  }

  /** Merges into the stored credentials. */
  private update(patch: Partial<BankCredentials>): void {
    this.save({ ...this.load(), ...patch })
  }

  private save(value: BankCredentials): void {
    this.ensureSource()
    this.db
      .update(dataSource)
      .set({ encryptedCredentials: this.crypto.encryptJson(value) })
      .where(eq(dataSource.id, BANK_SOURCE_ID))
      .run()
  }

  /** Maps client errors to HTTP errors with a German message. */
  private async call<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
        throw error
      }
      if (error instanceof AuthExpiredError) throw new BankCallbackError('expired')
      throw new BadGatewayException(
        error instanceof UpstreamError
          ? 'Enable Banking hat die Anfrage abgelehnt'
          : 'Enable Banking ist nicht erreichbar',
      )
    }
  }
}

/** Constant-time comparison of two strings. */
function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
