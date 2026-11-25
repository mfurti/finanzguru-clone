import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import type { DataSourceDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AppModule } from '../../src/app.module'
import { configureApp } from '../../src/app.setup'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  account,
  bankConsent,
  dataSource,
  institution,
  transaction,
} from '../../src/database/schema'
import {
  ENABLE_BANKING_HTTP,
  type EnableBankingHttp,
} from '../../src/modules/sources/enable-banking/client'
import { SyncService } from '../../src/modules/sources/sync.service'
import { loginCookie } from '../helpers/auth'
import { setTestEnv } from '../helpers/test-app'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, '../fixtures/enable-banking', `${name}.json`), 'utf8'))

/** Every request the fake Enable Banking side received ("METHOD /path?query"). */
const calls: string[] = []
/** Body of the last POST /auth. */
let authBody: { state: string; access: { valid_until: string }; redirect_url: string } | null = null
let mode: 'ok' | 'expired' | 'limit' = 'ok'

/** Stands in for api.enablebanking.com with the documented response shapes. */
const fakeHttp: EnableBankingHttp = async (url, init) => {
  const { pathname, search, searchParams } = new URL(url)
  calls.push(`${init.method} ${pathname}${search}`)
  const reply = (status: number, body: unknown) => ({ status, json: async () => body })
  if (!init.headers.Authorization?.startsWith('Bearer ey')) return reply(401, {})
  if (init.method === 'GET' && pathname === '/aspsps') return reply(200, fixture('aspsps'))
  if (init.method === 'POST' && pathname === '/auth') {
    authBody = JSON.parse(init.body ?? '{}')
    return reply(200, { url: 'https://bank.example.test/login?x=1', authorization_id: 'a1' })
  }
  if (init.method === 'POST' && pathname === '/sessions') return reply(200, fixture('session'))
  if (init.method === 'DELETE' && pathname.startsWith('/sessions/')) {
    return reply(200, { message: 'OK' })
  }
  if (mode === 'expired') {
    return reply(401, { code: 401, error: 'EXPIRED_SESSION', message: 'Session expired' })
  }
  if (mode === 'limit') {
    return reply(429, { code: 429, error: 'ASPSP_RATE_LIMIT_EXCEEDED', message: 'limit' })
  }
  if (pathname.endsWith('/details')) return reply(200, fixture('details'))
  if (pathname.endsWith('/balances')) return reply(200, fixture('balances'))
  if (pathname.endsWith('/transactions')) {
    const page = searchParams.get('continuation_key') === 'page-2' ? 2 : 1
    return reply(200, fixture(`transactions.page${page}`))
  }
  return reply(404, { error: 'NOT_FOUND' })
}

describe('bank connection and sync through Enable Banking (005 US1)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eb-'))
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const keyFile = join(dir, 'app.pem')
    writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }))
    setTestEnv({
      ENABLE_BANKING_APP_ID: '11111111-2222-4333-8444-555555555555',
      ENABLE_BANKING_KEY_FILE: keyFile,
      ENABLE_BANKING_API_URL: 'https://api.enablebanking.example.test',
    })
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENABLE_BANKING_HTTP)
      .useValue(fakeHttp)
      .compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await configureApp(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
    cookie = await loginCookie(app)
    db = app.get<AppDatabase>(DB)
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const bankSource = async () =>
    ((await call('GET', '/api/sources')).json() as DataSourceDto[]).find(
      (source) => source.id === 'enable_banking',
    )

  it('lists banks for personal accounts, sorted by name', async () => {
    const res = await call('GET', '/api/sources/bank/institutions?country=DE')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      { name: 'Sparkasse Musterstadt', country: 'DE', logo: 'https://example.test/logo.png' },
      { name: 'Testbank', country: 'DE', logo: null },
    ])
  })

  it('starts the login at the bank with a consent of at most 90 days', async () => {
    const res = await call('POST', '/api/sources/bank/connect', {
      aspspName: 'Sparkasse Musterstadt',
      aspspCountry: 'DE',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ authorizationUrl: 'https://bank.example.test/login?x=1' })
    const days = (new Date(authBody!.access.valid_until).getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(89)
    expect(days).toBeLessThanOrEqual(90)
    expect(authBody!.redirect_url).toMatch(/\/api\/sources\/bank\/callback$/)
    const unknown = await call('POST', '/api/sources/bank/connect', {
      aspspName: 'Nope',
      aspspCountry: 'DE',
    })
    expect(unknown.statusCode).toBe(400)
  })

  it('refuses a callback with a wrong state or a refusal at the bank', async () => {
    const wrong = await call('GET', '/api/sources/bank/callback?code=c1&state=forged')
    expect(wrong.headers.location).toBe('/settings/sources?error=bank&reason=state')
    const denied = await call('GET', '/api/sources/bank/callback?error=access_denied&state=x')
    expect(denied.headers.location).toBe('/settings/sources?error=bank&reason=denied')
  })

  let giro: typeof account.$inferSelect

  it('stores the consent after the bank login; responses never show the session', async () => {
    const inst = db.insert(institution).values({ name: 'Sparkasse' }).returning().get()
    giro = db
      .insert(account)
      .values({
        institutionId: inst.id,
        name: 'Sparkasse Girokonto …3000',
        type: 'checking',
        iban: 'DE89370400440532013000',
        sourceId: 'csv',
      })
      .returning()
      .get()
    // The CSV export had the card payment with another text and one day earlier.
    db.insert(transaction)
      .values({
        accountId: giro.id,
        bookingDate: '2026-11-02',
        amountCents: -5499,
        type: 'expense',
        counterparty: 'SUPERMARKT',
        purpose: 'KARTENZAHLUNG',
        source: 'csv',
        fingerprint: 'csv-1',
      })
      .run()

    const res = await call(
      'GET',
      `/api/sources/bank/callback?code=c1&state=${encodeURIComponent(authBody!.state)}`,
    )
    expect(res.headers.location).toBe('/settings/sources?connected=bank')
    const source = await bankSource()
    expect(source).toMatchObject({
      status: 'active',
      institution: 'Sparkasse Musterstadt',
      consentEndsAt: '2027-02-22T10:00:00+00:00',
      consentWarning: false,
      dailySync: false,
    })
    const body = (await call('GET', '/api/sources')).body
    expect(body).not.toMatch(/encrypted|session_id|00000000-0000-4000-8000-000000000001/i)
    // The state is used once.
    const again = await call(
      'GET',
      `/api/sources/bank/callback?code=c1&state=${encodeURIComponent(authBody!.state)}`,
    )
    expect(again.headers.location).toBe('/settings/sources?error=bank&reason=state')
  })

  it('syncs into the CSV account with the same IBAN without duplicates (SC-001, SC-002)', async () => {
    // The callback started the first sync right away, with the longest history (005 T035).
    const sync = app.get(SyncService)
    await vi.waitFor(() => expect(sync.isRunning('enable_banking')).toBe(false), {
      timeout: 10_000,
    })
    expect(sync.lastRun('enable_banking')).toMatchObject({
      status: 'partial',
      imported: 2,
      skipped: 1,
    })
    const reads = calls.filter((line) => line.includes('/transactions'))
    expect(reads[0]).toContain('strategy=longest')
    const rows = db.select().from(transaction).where(eq(transaction.accountId, giro.id)).all()
    expect(rows).toHaveLength(3)
    expect(rows.find((tx) => tx.fingerprint === 'csv-1')).toMatchObject({
      source: 'enable_banking',
      sourceRef: 'ref-002',
      purpose: 'KARTENZAHLUNG',
    })
    const after = db.select().from(account).where(eq(account.id, giro.id)).get()!
    expect(after).toMatchObject({ balanceCents: 123456, sourceId: 'enable_banking' })
    expect(db.select().from(account).all()).toHaveLength(1)

    const second = await sync.run('enable_banking')
    expect(second.imported).toBe(0)
    // Later syncs read the recent days only.
    expect(calls.filter((line) => line.includes('/transactions')).at(-1)).not.toContain('longest')
    expect(db.select().from(transaction).all()).toHaveLength(3)

    const source = await bankSource()
    expect(source!.accounts).toEqual([
      { id: giro.id, name: 'Sparkasse Girokonto …3000', maskedIban: 'DE89 •••• •••• 3000' },
    ])
    expect(source!.lastRun).toMatchObject({ imported: 0 })
  })

  it('starts a sync over HTTP and warns from 14 days before the consent ends', async () => {
    const res = await call('POST', '/api/sources/enable_banking/sync')
    expect(res.statusCode).toBe(202)
    const sync = app.get(SyncService)
    await vi.waitFor(() => expect(sync.isRunning('enable_banking')).toBe(false), {
      timeout: 10_000,
    })
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString()
    db.update(bankConsent).set({ validUntil: soon }).run()
    expect((await bankSource())!.consentWarning).toBe(true)
  })

  it('explains the daily limit of the bank in German', async () => {
    mode = 'limit'
    const outcome = await app.get(SyncService).run('enable_banking')
    expect(outcome.status).toBe('failed')
    expect((await bankSource())!.lastError).toMatch(/^Tageslimit der Bank erreicht/)
    mode = 'ok'
  })

  it('stops with consent_expired when the bank ended the session', async () => {
    mode = 'expired'
    const outcome = await app.get(SyncService).run('enable_banking')
    expect(outcome.status).toBe('failed')
    expect(await bankSource()).toMatchObject({
      status: 'consent_expired',
      lastError: 'Bankzugang abgelaufen – bitte erneuern',
    })
    mode = 'ok'
  })

  it('disconnects: session closed at Enable Banking, access deleted, data kept', async () => {
    const before = db.select().from(transaction).all().length
    const res = await call('DELETE', '/api/sources/enable_banking')
    expect(res.statusCode).toBe(204)
    expect(calls.some((line) => line.startsWith('DELETE /sessions/'))).toBe(true)
    const row = db.select().from(dataSource).where(eq(dataSource.id, 'enable_banking')).get()!
    expect(row).toMatchObject({ status: 'disabled', encryptedCredentials: null })
    expect(db.select().from(bankConsent).all()).toEqual([])
    expect(db.select().from(transaction).all()).toHaveLength(before)
    expect(db.select().from(account).all()).toHaveLength(1)
  })

  it('never called anything outside the read-only allowlist', () => {
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.some((line) => /payment/i.test(line))).toBe(false)
  })
})
