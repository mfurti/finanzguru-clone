import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { BrandSearchResult } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

describe('brand logos (008 T006)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })
  afterAll(() => app.close())

  it('serves the glyph in brand colour with a long cache', async () => {
    const res = await app.inject({ url: '/api/logos/brands/lidl.svg?v=1', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('image/svg+xml')
    expect(res.headers['cache-control']).toContain('immutable')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.body).toContain('fill="#0050AA"')
  })

  it('serves coloured logos with a CSP that forbids scripts', async () => {
    const res = await app.inject({
      url: '/api/logos/brands/thesvg-color/amazon.svg?v=1',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('image/svg+xml')
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    )
    expect(res.body).not.toMatch(/<script|javascript:/i)
    const glyph = await app.inject({
      url: '/api/logos/brands/simple-icons/lidl.svg',
      headers: { cookie },
    })
    expect(glyph.body).toContain('fill="#0050AA"')
    for (const url of [
      '/api/logos/brands/other/lidl.svg',
      '/api/logos/brands/thesvg-color/apple-dark.svg',
    ]) {
      expect((await app.inject({ url, headers: { cookie } })).statusCode).toBe(404)
    }
  })

  it('answers 404 for unknown or malformed slugs', async () => {
    for (const slug of ['gibtsnicht', 'LIDL', '..%2Fx']) {
      const res = await app.inject({ url: `/api/logos/brands/${slug}.svg`, headers: { cookie } })
      expect(res.statusCode).toBe(404)
    }
  })

  it('searches the catalogue, curated brands first', async () => {
    const hits = (await app
      .inject({ url: '/api/logos/brands?q=lid', headers: { cookie } })
      .then((res) => res.json())) as BrandSearchResult[]
    // Lidl is listed once; the curated (preferred) key wins over the duplicate in the other set.
    const lidl = hits.filter((hit) => hit.title === 'Lidl')
    expect(lidl).toHaveLength(1)
    expect(lidl[0]!.url).toMatch(/^\/api\/logos\/brands\/[a-z-]+\/lidl\.svg\?v=/)
    expect(hits.some((hit) => hit.slug.startsWith('thesvg-color:'))).toBe(true)
    const curated = (await app
      .inject({ url: '/api/logos/brands?limit=3', headers: { cookie } })
      .then((res) => res.json())) as BrandSearchResult[]
    expect(curated.map((hit) => hit.slug)).toEqual([
      'simple-icons:rewe',
      'simple-icons:lidl',
      'simple-icons:aldisud',
    ])
    const bad = await app.inject({ url: '/api/logos/brands?limit=99', headers: { cookie } })
    expect(bad.statusCode).toBe(400)
  })

  it('needs the owner session', async () => {
    expect((await app.inject({ url: '/api/logos/brands?q=lidl' })).statusCode).toBe(401)
    expect((await app.inject({ url: '/api/logos/brands/lidl.svg' })).statusCode).toBe(401)
  })
})
