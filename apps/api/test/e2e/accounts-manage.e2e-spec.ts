import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto, AccountTree } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoResult } from '../../src/database/demo'
import { createDemoApp } from '../helpers/demo-app'

/** 014 T004: rename, hide, archive and reorder accounts. */
describe('account management (014)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let demo: DemoResult

  beforeAll(async () => {
    ;({ app, cookie, demo } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'PATCH' | 'POST', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })
  const total = async () =>
    (await call('GET', '/api/accounts/tree'))
      .json<AccountTree>()
      .groups.reduce((sum, group) => sum + group.totalCents, 0)

  it('renames an account', async () => {
    const response = await call('PATCH', `/api/accounts/${demo.checkingId}`, { name: 'Giro neu' })
    expect(response.statusCode).toBe(200)
    expect(response.json<AccountDto>().name).toBe('Giro neu')
  })

  it('reorders all accounts and refuses an incomplete order', async () => {
    const before = (await call('GET', '/api/accounts')).json<AccountDto[]>()
    const reversed = before.map((acc) => acc.id).reverse()
    const response = await call('POST', '/api/accounts/order', { ids: reversed })
    expect(response.statusCode).toBe(200)
    expect(response.json<AccountDto[]>().map((acc) => acc.id)).toEqual(reversed)
    expect((await call('POST', '/api/accounts/order', { ids: reversed.slice(1) })).statusCode).toBe(
      400,
    )
    expect(
      (await call('POST', '/api/accounts/order', { ids: [reversed[0], reversed[0]] })).statusCode,
    ).toBe(400)
  })

  it('archived accounts leave the sums unless the owner keeps them', async () => {
    const all = await total()
    const archived = await call('PATCH', `/api/accounts/${demo.checkingId}`, { archived: true })
    expect(archived.json<AccountDto>().archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    const without = await total()
    expect(without).toBeLessThan(all)

    await call('PATCH', '/api/settings', { archivedInSums: true })
    expect(await total()).toBe(all)
    await call('PATCH', '/api/settings', { archivedInSums: false })

    const restored = await call('PATCH', `/api/accounts/${demo.checkingId}`, { archived: false })
    expect(restored.json<AccountDto>().archivedAt).toBeNull()
    expect(await total()).toBe(all)
  })

  it('hidden accounts leave the sums', async () => {
    const all = await total()
    await call('PATCH', `/api/accounts/${demo.checkingId}`, { isHidden: true })
    expect(await total()).toBeLessThan(all)
    await call('PATCH', `/api/accounts/${demo.checkingId}`, { isHidden: false })
  })
})
