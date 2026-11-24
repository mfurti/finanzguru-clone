import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDetail, AccountsOverview, CsvUploadResponse } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DemoResult } from '../../src/database/demo'
import { createDemoApp } from '../helpers/demo-app'
import { multipartBody } from '../helpers/multipart'

describe('accounts overview and detail (003 US2)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let demo: DemoResult

  beforeAll(async () => {
    ;({ app, cookie, demo } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST', url: string) =>
    app.inject({ method, url, headers: { cookie } })

  it('groups depots and accounts with totals, masked IBAN and sparkline', async () => {
    const res = await call('GET', '/api/accounts/overview')
    expect(res.statusCode).toBe(200)
    const body = res.json() as AccountsOverview
    expect(body.groups.map((group) => group.kind)).toEqual(['depot', 'account'])
    for (const group of body.groups) {
      expect(group.totalCents).toBe(group.rows.reduce((sum, row) => sum + row.balanceCents, 0))
      for (const row of group.rows) {
        expect(row.sparkline.length).toBeGreaterThanOrEqual(2)
        expect(row.sparkline.length).toBeLessThanOrEqual(30)
        expect(row.balanceCents).toBe(row.sparkline.at(-1))
        expect(row.initials).toMatch(/^[\p{L}\p{N}?]{1,2}$/u)
        if (row.iban) expect(row.ibanMasked).toMatch(/^[A-Z]{2}\d{2} •••• •••• \w{4}$/)
        expect(row.canSync).toBe(false)
      }
    }
    const giro = body.groups
      .flatMap((group) => group.rows)
      .find((row) => row.id === demo.checkingId)
    expect(giro).toBeDefined()
  })

  it('reports the last CSV import and refuses "Aktualisieren" for it', async () => {
    const file = readFileSync(join(__dirname, '../fixtures/csv', 'sparkasse-camt-v8.csv'))
    const body = await multipartBody(file, 'konto.csv')
    const uploaded = (
      await app.inject({
        method: 'POST',
        url: '/api/import/csv',
        headers: { ...body.headers, cookie },
        payload: body.payload,
      })
    ).json() as CsvUploadResponse
    const job = (
      await app.inject({
        method: 'POST',
        url: `/api/import/csv/${uploaded.jobId}/confirm`,
        headers: { cookie },
        payload: {},
      })
    ).json() as { accountId?: string | null }
    const rows = (
      (await call('GET', '/api/accounts/overview')).json() as AccountsOverview
    ).groups.flatMap((group) => group.rows)
    const imported = rows.find((row) => row.lastUpdateKind === 'import')
    expect(imported, JSON.stringify(job)).toBeDefined()
    expect(imported!.lastUpdateAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect((await call('POST', `/api/accounts/${imported!.id}/sync`)).statusCode).toBe(409)
    expect((await call('POST', '/api/accounts/missing/sync')).statusCode).toBe(404)
  })

  it('returns history and figures for one account and period', async () => {
    const res = await call('GET', `/api/accounts/${demo.checkingId}/detail?period=1Y`)
    expect(res.statusCode).toBe(200)
    const body = res.json() as AccountDetail
    expect(body.account.id).toBe(demo.checkingId)
    expect(body.history.length).toBeGreaterThan(300)
    expect(body.figures.changeCents).toBe(
      body.history.at(-1)!.valueCents - body.history[0]!.valueCents,
    )
    expect(body.figures.inflowCents).toBeGreaterThan(0)
    expect(body.figures.outflowCents).toBeLessThan(0)
    const custom = (
      await call('GET', `/api/accounts/${demo.checkingId}/detail?from=2026-03-01&to=2026-06-30`)
    ).json() as AccountDetail
    expect(custom.history[0]!.date).toBe('2026-03-01')
    expect(custom.history.at(-1)!.date).toBe('2026-06-30')
    expect((await call('GET', '/api/accounts/missing/detail')).statusCode).toBe(404)
    expect(
      (await call('GET', `/api/accounts/${demo.checkingId}/detail?from=2026-07-01&to=2026-06-01`))
        .statusCode,
    ).toBe(400)
  })
})
