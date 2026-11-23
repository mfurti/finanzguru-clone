import { Body, Controller, Get, NotFoundException, Post } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createZodDto } from 'nestjs-zod'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createTestApp } from '../helpers/test-app'

class EchoDto extends createZodDto(
  z.object({ name: z.string().min(2), amountCents: z.number().int() }),
) {}

@Controller('test-only')
class TestOnlyController {
  @Post('echo')
  echo(@Body() body: EchoDto) {
    return body
  }

  @Get('missing')
  missing() {
    throw new NotFoundException('Nicht gefunden')
  }

  @Get('boom')
  boom() {
    throw new Error('secret internal detail')
  }
}

describe('health, validation and error format', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TestOnlyController] })
  })

  afterAll(async () => {
    await app?.close()
  })

  it('GET /api/health reports ok with a working DB', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' })
  })

  it('rejects invalid bodies with 400 and issue paths', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/test-only/echo',
      payload: { name: 'x', amountCents: 1.5 },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.statusMessage).toBe('Validation failed')
    expect(body.data.issues.map((issue: { path: string }) => issue.path).sort()).toEqual([
      'amountCents',
      'name',
    ])
  })

  it('passes valid bodies through', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/test-only/echo',
      payload: { name: 'ok', amountCents: 150 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ name: 'ok', amountCents: 150 })
  })

  it('maps HttpExceptions to { statusCode, statusMessage }', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test-only/missing' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ statusCode: 404, statusMessage: 'Nicht gefunden' })
  })

  it('hides internals of unexpected errors', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/test-only/boom' })
    expect(res.statusCode).toBe(500)
    expect(res.body).not.toContain('secret internal detail')
  })

  it('serves Swagger outside production', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs-json' })
    expect(res.statusCode).toBe(200)
    expect(Object.keys(res.json().paths)).toContain('/api/health')
  })
})
