import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AboutDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { latestMigration } from '../../src/common/app-version'
import { createDemoApp } from '../helpers/demo-app'

/** 014 T014: Über die App. */
describe('GET /api/about (014)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  it('needs the owner session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/about' })).statusCode).toBe(401)
  })

  it('returns version, schema, database size and sources', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/about', headers: { cookie } })
    expect(response.statusCode).toBe(200)
    const about = response.json<AboutDto>()
    expect(about.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(about.migration).toBe(latestMigration().tag)
    expect(about.databaseBytes).toBeGreaterThan(10_000)
    expect(Array.isArray(about.sources)).toBe(true)
  })
})
