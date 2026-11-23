import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

describe('AppModule (e2e smoke)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    process.env.API_SESSION_SECRET = 'x'.repeat(32)
    process.env.API_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64')
    process.env.DATABASE_PATH = ':memory:'
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    app.setGlobalPrefix('api')
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('answers unknown routes with 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' })
    expect(res.statusCode).toBe(404)
  })
})
