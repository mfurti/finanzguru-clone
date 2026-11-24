import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { SearchResult } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDemoApp } from '../helpers/demo-app'

describe('global search (003 US7)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const search = async (q: string) => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/search?q=${encodeURIComponent(q)}`,
      headers: { cookie },
    })
    return { status: res.statusCode, body: res.json() as SearchResult }
  }

  it('needs at least two characters', async () => {
    expect((await search('a')).status).toBe(400)
    expect((await search(' ')).status).toBe(400)
  })

  it('finds accounts, securities by name and ISIN, pages and bookings', async () => {
    const giro = (await search('Giro')).body
    expect(giro.accounts.map((hit) => hit.label)).toContain('Demo Girokonto')
    expect(giro.accounts[0]!.to).toMatch(/^\/accounts\//)
    const msci = (await search('MSCI')).body
    expect(msci.instruments.length).toBeGreaterThan(0)
    expect(msci.instruments[0]!.to).toMatch(/^\/investments\//)
    const isin = (await search('IE00B4L5Y983')).body
    expect(isin.instruments).toHaveLength(1)
    expect((await search('dividenden')).body.pages.map((hit) => hit.to)).toContain(
      '/investments/dividends',
    )
    const rent = (await search('Hausverwaltung')).body
    expect(rent.transactions.length).toBeGreaterThan(0)
    expect(rent.transactions[0]!.to).toBe('/transactions?q=Hausverwaltung')
  })

  it('caps every group at five hits and reports nothing for unknown terms', async () => {
    const many = (await search('Demo')).body
    for (const group of Object.values(many)) expect(group.length).toBeLessThanOrEqual(5)
    const none = (await search('kein-treffer-xyz')).body
    expect(Object.values(none).every((group) => group.length === 0)).toBe(true)
  })
})
