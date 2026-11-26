import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { BrandSearchResult, TransactionPage } from '@finance/shared'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, transaction } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** Smallest valid PNG (1×1). */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082',
  'hex',
)

/** Invented brands only: real logos never go into tests or the repository. */
function localFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'brand-logos-'))
  writeFileSync(
    join(dir, 'brands.json'),
    JSON.stringify([
      {
        key: 'musterbroker',
        title: 'Musterbroker',
        words: ['musterbroker capital'],
        file: 'm.png',
      },
      { key: 'beispielbank', title: 'Beispielbank', words: ['beispielbank'], file: 'b.svg' },
    ]),
  )
  writeFileSync(join(dir, 'm.png'), PNG)
  writeFileSync(
    join(dir, 'b.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2"/></svg>',
  )
  return dir
}

describe('local logos (009 T004)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp({}, { BRAND_LOGOS_DIR: localFolder() })
    cookie = await loginCookie(app)
  })
  afterAll(() => app.close())

  it('serves local PNG and SVG files to the owner only', async () => {
    const png = await app.inject({
      url: '/api/logos/brands/local/musterbroker',
      headers: { cookie },
    })
    expect(png.statusCode).toBe(200)
    expect(png.headers['content-type']).toBe('image/png')
    expect(png.headers['cache-control']).toBe('private, max-age=86400')
    expect(png.rawPayload.equals(PNG)).toBe(true)
    const svg = await app.inject({
      url: '/api/logos/brands/local/beispielbank',
      headers: { cookie },
    })
    expect(svg.headers['content-type']).toContain('image/svg+xml')
    expect(svg.headers['content-security-policy']).toContain("default-src 'none'")
    expect((await app.inject({ url: '/api/logos/brands/local/musterbroker' })).statusCode).toBe(401)
    for (const key of ['gibtsnicht', '..%2Fbrands.json', 'Muster']) {
      const res = await app.inject({ url: `/api/logos/brands/local/${key}`, headers: { cookie } })
      expect(res.statusCode).toBe(404)
    }
  })

  it('lists local brands first in the search with their URL', async () => {
    const hits = (await app
      .inject({ url: '/api/logos/brands?q=muster', headers: { cookie } })
      .then((res) => res.json())) as BrandSearchResult[]
    expect(hits[0]).toMatchObject({
      slug: 'local:musterbroker',
      title: 'Musterbroker',
      hex: null,
      url: expect.stringMatching(/^\/api\/logos\/brands\/local\/musterbroker\?v=[0-9a-f]{12}$/),
    })
    const first = (await app
      .inject({ url: '/api/logos/brands?limit=2', headers: { cookie } })
      .then((res) => res.json())) as BrandSearchResult[]
    expect(first.map((hit) => hit.slug)).toEqual(['local:musterbroker', 'local:beispielbank'])
  })

  it('uses local logos for booking recipients too (009 T008)', async () => {
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Lokaltestbank' }).returning().get()
    const acc = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Lokal-Giro', type: 'checking' })
      .returning()
      .get()
    db.insert(transaction)
      .values({
        accountId: acc.id,
        bookingDate: '2026-11-20',
        amountCents: -10000,
        type: 'expense',
        source: 'manual',
        counterparty: 'Musterbroker Capital Bank GmbH',
        fingerprint: 'local-1',
      })
      .run()
    const page = (await app
      .inject({ url: `/api/transactions?accounts=${acc.id}`, headers: { cookie } })
      .then((res) => res.json())) as TransactionPage
    expect(page.items[0]).toMatchObject({
      logo: { kind: 'brand', slug: 'local:musterbroker' },
      logoSource: 'auto',
    })
  })
})
