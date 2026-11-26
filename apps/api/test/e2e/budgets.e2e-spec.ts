import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto, BudgetDto, CategoryNode } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('budgets API', () => {
  let app: NestFastifyApplication
  let cookie: string
  let tree: CategoryNode[]

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    tree = (await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie } })).json()
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('tracks spending of the current month against the limit, incl. sub categories', async () => {
    const lebenshaltung = tree.find((node) => node.name === 'Lebenshaltung')!
    const lebensmittel = lebenshaltung.children.find(
      (child) => child.name === 'Lebensmittel und Getränke',
    )!
    const acc = (
      await call('POST', '/api/accounts', { name: 'Giro', type: 'checking', balanceCents: 100000 })
    ).json() as AccountDto
    const today = new Date().toISOString().slice(0, 10)
    await call('POST', '/api/transactions', {
      accountId: acc.id,
      bookingDate: today,
      amountCents: -12345,
      type: 'expense',
      categoryId: lebensmittel.id,
    })

    const created = await call('POST', '/api/budgets', {
      categoryId: lebenshaltung.id,
      monthlyLimitCents: 50000,
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      categoryName: 'Lebenshaltung',
      monthlyLimitCents: 50000,
      spentCents: 12345,
      remainingCents: 37655,
    })

    expect(
      (await call('POST', '/api/budgets', { categoryId: lebenshaltung.id, monthlyLimitCents: 1 }))
        .statusCode,
    ).toBe(409)
    const updated = await call('PATCH', `/api/budgets/${(created.json() as BudgetDto).id}`, {
      monthlyLimitCents: 60000,
    })
    expect(updated.json().remainingCents).toBe(47655)
    expect((await call('GET', '/api/budgets')).json()).toHaveLength(1)
    expect(
      (await call('DELETE', `/api/budgets/${(created.json() as BudgetDto).id}`)).statusCode,
    ).toBe(204)
  })

  it('rejects income categories and non-positive limits', async () => {
    const einnahmen = tree.find((node) => node.name === 'Einnahmen')!
    expect(
      (await call('POST', '/api/budgets', { categoryId: einnahmen.id, monthlyLimitCents: 100 }))
        .statusCode,
    ).toBe(400)
    const wohnen = tree.find((node) => node.name === 'Wohnen')!
    expect(
      (await call('POST', '/api/budgets', { categoryId: wohnen.id, monthlyLimitCents: 0 }))
        .statusCode,
    ).toBe(400)
  })
})
