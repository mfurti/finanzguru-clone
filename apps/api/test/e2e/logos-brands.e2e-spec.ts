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
    expect(hits.map((hit) => hit.slug)).toContain('lidl')
    expect(hits[0]!.url).toMatch(/^\/api\/logos\/brands\/lidl\.svg\?v=/)
    const curated = (await app
      .inject({ url: '/api/logos/brands?limit=3', headers: { cookie } })
      .then((res) => res.json())) as BrandSearchResult[]
    expect(curated.map((hit) => hit.slug)).toEqual(['rewe', 'lidl', 'aldisud'])
    const bad = await app.inject({ url: '/api/logos/brands?limit=99', headers: { cookie } })
    expect(bad.statusCode).toBe(400)
  })

  it('needs the owner session', async () => {
    expect((await app.inject({ url: '/api/logos/brands?q=lidl' })).statusCode).toBe(401)
    expect((await app.inject({ url: '/api/logos/brands/lidl.svg' })).statusCode).toBe(401)
  })
})
