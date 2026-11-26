import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CategorizationRuleDto, CategoryNode } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('categories and rules API', () => {
  let app: NestFastifyApplication
  let cookie: string
  let tree: CategoryNode[]

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
    tree = (await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie } })).json()
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('returns the default tree', () => {
    const wohnen = tree.find((node) => node.name === 'Wohnen')!
    expect(wohnen.isDefault).toBe(true)
    expect(wohnen.children.map((child) => child.name)).toContain('Strom')
  })

  it('creates sub categories, enforces depth 2 and unique names', async () => {
    const wohnen = tree.find((node) => node.name === 'Wohnen')!
    const created = await call('POST', '/api/categories', {
      parentId: wohnen.id,
      name: 'Garage',
      kind: 'expense',
    })
    expect(created.statusCode).toBe(201)
    const garage = created.json() as CategoryNode
    expect(
      (
        await call('POST', '/api/categories', {
          parentId: garage.id,
          name: 'Zu tief',
          kind: 'expense',
        })
      ).statusCode,
    ).toBe(400)
    expect(
      (
        await call('POST', '/api/categories', {
          parentId: wohnen.id,
          name: 'Garage',
          kind: 'expense',
        })
      ).statusCode,
    ).toBe(409)
    expect(
      (await call('PATCH', `/api/categories/${garage.id}`, { name: 'Stellplatz' })).json().name,
    ).toBe('Stellplatz')
    expect((await call('DELETE', `/api/categories/${garage.id}`)).statusCode).toBe(204)
  })

  it('refuses to delete default categories', async () => {
    const strom = tree
      .find((node) => node.name === 'Wohnen')!
      .children.find((child) => child.name === 'Strom')!
    expect((await call('DELETE', `/api/categories/${strom.id}`)).statusCode).toBe(409)
  })

  it('manages rules with unique priorities and applies them', async () => {
    const groceries = tree
      .find((node) => node.name === 'Lebenshaltung')!
      .children.find((child) => child.name === 'Lebensmittel und Getränke')!
    const a = (
      await call('POST', '/api/rules', {
        matchField: 'counterparty',
        operator: 'contains',
        pattern: 'Supermarkt',
        categoryId: groceries.id,
      })
    ).json() as CategorizationRuleDto
    const b = (
      await call('POST', '/api/rules', {
        matchField: 'counterparty',
        operator: 'contains',
        pattern: 'Discounter',
        categoryId: groceries.id,
      })
    ).json() as CategorizationRuleDto
    expect([a.priority, b.priority]).toEqual([1, 2])

    const moved = (
      await call('PATCH', `/api/rules/${b.id}`, { priority: 1 })
    ).json() as CategorizationRuleDto
    expect(moved.priority).toBe(1)
    const rules = (await call('GET', '/api/rules')).json() as CategorizationRuleDto[]
    expect(rules.map((rule) => rule.id)).toEqual([b.id, a.id])

    expect(
      (
        await call('POST', '/api/rules', {
          matchField: 'purpose',
          operator: 'regex',
          pattern: '(',
          categoryId: groceries.id,
        })
      ).statusCode,
    ).toBe(400)

    const applied = await call('POST', '/api/rules/apply')
    expect(applied.statusCode).toBe(200)
    expect(applied.json().updated).toBe(3)
    const count = (await call('GET', '/api/transactions/unreviewed/count')).json()
    expect(count.count).toBe(0)

    expect((await call('DELETE', `/api/rules/${a.id}`)).statusCode).toBe(204)
  })
})
