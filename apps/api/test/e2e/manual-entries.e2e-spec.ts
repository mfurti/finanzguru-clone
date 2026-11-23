import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto, NetWorthResponse, TransactionDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('manual accounts and transactions (FR-056)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('creates a cash account that shows up in net worth', async () => {
    const res = await call('POST', '/api/accounts', {
      name: 'Bargeld',
      type: 'cash',
      balanceCents: 12345,
    })
    expect(res.statusCode).toBe(201)
    const acc = res.json() as AccountDto
    expect(acc).toMatchObject({ name: 'Bargeld', institutionName: 'Manuell', balanceCents: 12345 })
    const worth = (
      await call('GET', '/api/overview/net-worth?period=1W')
    ).json() as NetWorthResponse
    expect(worth.totalCents).toBe(12345)
  })

  it('validates IBANs and rejects duplicates', async () => {
    expect(
      (await call('POST', '/api/accounts', { name: 'X', type: 'checking', iban: 'DE00 1234' }))
        .statusCode,
    ).toBe(400)
    const ok = await call('POST', '/api/accounts', {
      name: 'Giro',
      type: 'checking',
      iban: 'DE89 3704 0044 0532 0130 00',
    })
    expect(ok.json().iban).toBe('DE89370400440532013000')
    expect(
      (
        await call('POST', '/api/accounts', {
          name: 'Giro 2',
          type: 'checking',
          iban: 'DE89370400440532013000',
        })
      ).statusCode,
    ).toBe(409)
  })

  it('books a manual transaction and updates the balance', async () => {
    const acc = (
      await call('POST', '/api/accounts', {
        name: 'Haushaltskasse',
        type: 'cash',
        balanceCents: 10000,
      })
    ).json() as AccountDto
    const res = await call('POST', '/api/transactions', {
      accountId: acc.id,
      bookingDate: '2026-11-01',
      amountCents: -2500,
      type: 'expense',
      counterparty: 'Wochenmarkt',
    })
    expect(res.statusCode).toBe(201)
    expect((res.json() as TransactionDto).reviewStatus).toBe('unreviewed')
    const after = (await call('GET', '/api/accounts')).json() as AccountDto[]
    expect(after.find((item) => item.id === acc.id)?.balanceCents).toBe(7500)
  })

  it('rejects buys without ISIN and income on depots', async () => {
    const depot = (await call('POST', '/api/accounts', { name: 'Depot', type: 'depot' })).json()
    expect(
      (
        await call('POST', '/api/transactions', {
          accountId: depot.id,
          bookingDate: '2026-11-01',
          amountCents: -100,
          type: 'buy',
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await call('POST', '/api/transactions', {
          accountId: depot.id,
          bookingDate: '2026-11-01',
          amountCents: 100,
          type: 'income',
        })
      ).statusCode,
    ).toBe(400)
  })

  it('updates, hides and deletes accounts (409 with bookings unless forced)', async () => {
    const acc = (
      await call('POST', '/api/accounts', { name: 'Sparbuch', type: 'savings', balanceCents: 500 })
    ).json() as AccountDto
    const patched = await call('PATCH', `/api/accounts/${acc.id}`, {
      name: 'Tagesgeld',
      isHidden: true,
    })
    expect(patched.json()).toMatchObject({ name: 'Tagesgeld', isHidden: true })
    await call('POST', '/api/transactions', {
      accountId: acc.id,
      bookingDate: '2026-11-02',
      amountCents: 100,
      type: 'income',
    })
    expect((await call('DELETE', `/api/accounts/${acc.id}`)).statusCode).toBe(409)
    expect((await call('DELETE', `/api/accounts/${acc.id}?force=true`)).statusCode).toBe(204)
    expect((await call('DELETE', `/api/accounts/${acc.id}`)).statusCode).toBe(404)
  })
})

describe('GET /api/sources', () => {
  it('lists the default sources without credentials', async () => {
    const app = await createTestApp()
    const cookie = await loginCookie(app)
    const res = await app.inject({ method: 'GET', url: '/api/sources', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { kind: string; status: string }[]
    expect(body.map((source) => [source.kind, source.status])).toEqual([
      ['csv', 'active'],
      ['sparkasse_fints', 'planned'],
    ])
    expect(JSON.stringify(body)).not.toContain('encrypted')
    await app.close()
  })
})
