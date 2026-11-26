import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { InsuranceDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

const contract = {
  type: 'term_life',
  provider: 'Demo Versicherung AG',
  contractNumber: 'RLV-0001',
  premiumCents: 2362,
  interval: 'monthly',
  startDate: '2024-01-01',
}

describe('insurance API (US6)', () => {
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

  it('V12: creates a contract with its yearly cost', async () => {
    const res = await call('POST', '/api/insurance', contract)
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ provider: 'Demo Versicherung AG', yearlyCostCents: 28344 })
  })

  it('computes yearly cost per interval', async () => {
    const quarterly = (
      await call('POST', '/api/insurance', {
        ...contract,
        interval: 'quarterly',
        premiumCents: 10000,
      })
    ).json() as InsuranceDto
    expect(quarterly.yearlyCostCents).toBe(40000)
    const updated = (
      await call('PATCH', `/api/insurance/${quarterly.id}`, {
        ...contract,
        interval: 'annual',
        premiumCents: 10000,
      })
    ).json() as InsuranceDto
    expect(updated.yearlyCostCents).toBe(10000)
    expect((await call('DELETE', `/api/insurance/${quarterly.id}`)).statusCode).toBe(204)
    expect((await call('DELETE', `/api/insurance/${quarterly.id}`)).statusCode).toBe(404)
  })

  it('validates premium, dates, notes length and type', async () => {
    expect(
      (await call('POST', '/api/insurance', { ...contract, premiumCents: 0 })).statusCode,
    ).toBe(400)
    expect(
      (await call('POST', '/api/insurance', { ...contract, endDate: '2023-12-31' })).statusCode,
    ).toBe(400)
    expect(
      (await call('POST', '/api/insurance', { ...contract, notes: 'x'.repeat(2001) })).statusCode,
    ).toBe(400)
    expect((await call('POST', '/api/insurance', { ...contract, type: 'pet' })).statusCode).toBe(
      400,
    )
  })

  it('lists contracts', async () => {
    const list = (await call('GET', '/api/insurance')).json() as InsuranceDto[]
    expect(list).toHaveLength(1)
  })
})
