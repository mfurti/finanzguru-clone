import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto, AccountTree } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoResult } from '../../src/database/demo'
import { createDemoApp } from '../helpers/demo-app'

const expected = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/demo-expected.json'), 'utf8'),
) as { totalCents: number; unreviewed: number }

describe('accounts and unreviewed count', () => {
  let app: NestFastifyApplication
  let cookie: string
  let demo: DemoResult

  beforeAll(async () => {
    ;({ app, cookie, demo } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = async <T>(url: string): Promise<T> => {
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }

  it('lists accounts with their institution', async () => {
    const accounts = await get<AccountDto[]>('/api/accounts')
    expect(accounts.map((acc) => acc.name)).toEqual([
      'Demo Depot',
      'Demo Referenzkonto',
      'Demo Girokonto',
    ])
    expect(accounts[2]?.institutionName).toBe('Demo Bank')
  })

  it('groups depots (with reference account) and other accounts', async () => {
    const tree = await get<AccountTree>('/api/accounts/tree')
    expect(tree.groups.map((group) => group.type)).toEqual(['depots', 'accounts'])
    const depot = tree.groups[0]!.items[0]!
    expect(depot.children?.map((child) => child.name)).toEqual(['Demo Referenzkonto'])
    const total = tree.groups.reduce((sum, group) => sum + group.totalCents, 0)
    expect(total).toBe(expected.totalCents)
  })

  it('respects the account filter', async () => {
    const tree = await get<AccountTree>(`/api/accounts/tree?accounts=${demo.checkingId}`)
    expect(tree.groups).toHaveLength(1)
    expect(tree.groups[0]?.totalCents).toBe(437737)
  })

  it('counts unreviewed transactions without category', async () => {
    const body = await get<{ count: number }>('/api/transactions/unreviewed/count')
    expect(body.count).toBe(expected.unreviewed)
    const depotOnly = await get<{ count: number }>(
      `/api/transactions/unreviewed/count?accounts=${demo.depotId}`,
    )
    expect(depotOnly.count).toBe(0)
  })
})
