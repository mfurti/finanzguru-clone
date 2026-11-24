import { generateKeyPairSync } from 'node:crypto'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import { describe, expect, it } from 'vitest'
import {
  EnableBankingClient,
  type EnableBankingHttp,
  isAllowedEndpoint,
  sanitizeError,
} from '../../src/modules/sources/enable-banking/client'
import {
  AuthExpiredError,
  ForbiddenToolError,
  UpstreamError,
} from '../../src/modules/sources/errors'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const appId = '11111111-2222-3333-4444-555555555555'

function client(reply: { status: number; body: unknown }, calls: string[] = []) {
  const http: EnableBankingHttp = async (url, init) => {
    calls.push(`${init.method} ${url} ${init.headers.Authorization ?? ''}`)
    return { status: reply.status, json: async () => reply.body }
  }
  return new EnableBankingClient({
    appId,
    privateKeyPem,
    baseUrl: 'https://api.example.test',
    http,
    now: () => 1_800_000_000,
  })
}

describe('Enable Banking client (005 T007)', () => {
  it('signs a one-hour RS256 token with the app id as kid', async () => {
    const token = await client({ status: 200, body: {} }).token()
    expect(decodeProtectedHeader(token)).toEqual({ typ: 'JWT', alg: 'RS256', kid: appId })
    expect(decodeJwt(token)).toEqual({
      iss: 'enablebanking.com',
      aud: 'api.enablebanking.com',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    })
  })

  it('allows only the read endpoints', () => {
    expect(isAllowedEndpoint('GET', '/aspsps?country=DE')).toBe(true)
    expect(isAllowedEndpoint('POST', '/auth')).toBe(true)
    expect(isAllowedEndpoint('POST', '/sessions')).toBe(true)
    expect(isAllowedEndpoint('DELETE', '/sessions/abc-1')).toBe(true)
    expect(isAllowedEndpoint('GET', '/accounts/u-1/transactions?date_from=2026-01-01')).toBe(true)
    expect(isAllowedEndpoint('POST', '/payments')).toBe(false)
    expect(isAllowedEndpoint('GET', '/payments/p1')).toBe(false)
    expect(isAllowedEndpoint('POST', '/accounts/u-1/transactions')).toBe(false)
    expect(isAllowedEndpoint('GET', '/accounts/u-1/../../payments')).toBe(false)
  })

  it('sends signed requests and returns the payload', async () => {
    const calls: string[] = []
    const result = await client({ status: 200, body: { balances: [] } }, calls).balances('u-1')
    expect(result).toEqual({ balances: [] })
    expect(calls[0]).toMatch(/^GET https:\/\/api\.example\.test\/accounts\/u-1\/balances Bearer ey/)
  })

  it('refuses ids with characters outside the allowlist pattern', async () => {
    const calls: string[] = []
    await expect(client({ status: 200, body: {} }, calls).balances('u 1')).rejects.toBeInstanceOf(
      ForbiddenToolError,
    )
    expect(calls).toEqual([])
  })

  it('maps a gone session to AuthExpiredError and other failures to UpstreamError', async () => {
    await expect(
      client({ status: 400, body: { error: 'EXPIRED_SESSION', message: 'expired' } }).balances(
        'u1',
      ),
    ).rejects.toBeInstanceOf(AuthExpiredError)
    await expect(client({ status: 401, body: {} }).balances('u1')).rejects.toBeInstanceOf(
      AuthExpiredError,
    )
    await expect(
      client({ status: 503, body: { message: 'down' } }).balances('u1'),
    ).rejects.toBeInstanceOf(UpstreamError)
  })

  it('never lets a forbidden call reach the transport', async () => {
    const calls: string[] = []
    const c = client({ status: 200, body: {} }, calls) as unknown as {
      request: (method: string, path: string) => Promise<unknown>
    }
    await expect(c.request('POST', '/payments')).rejects.toBeInstanceOf(ForbiddenToolError)
    expect(calls).toEqual([])
  })

  it('removes tokens and ids from error text and caps it at 500 chars', () => {
    const text = sanitizeError(
      `bad eyJabc.def.ghi session 0f8fad5b-d9cb-469f-a165-70867728950e ${'x'.repeat(600)}`,
    )
    expect(text).not.toContain('eyJ')
    expect(text).not.toContain('0f8fad5b')
    expect(text.length).toBe(500)
  })
})
