import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TagDto } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { transaction, transactionTag } from '../../src/database/schema'
import { createDemoApp } from '../helpers/demo-app'

describe('tags API (003 US1)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('creates, renames, recolors and lists tags with usage', async () => {
    const created = await call('POST', '/api/tags', { name: ' Urlaub ' })
    expect(created.statusCode).toBe(201)
    const urlaub = created.json() as TagDto
    expect(urlaub).toMatchObject({ name: 'Urlaub', color: 'neutral', usage: 0 })

    const db = app.get<AppDatabase>(DB)
    const booking = db.select({ id: transaction.id }).from(transaction).limit(1).get()!
    db.insert(transactionTag).values({ transactionId: booking.id, tagId: urlaub.id }).run()

    const patched = await call('PATCH', `/api/tags/${urlaub.id}`, { name: 'Reise', color: 'sky' })
    expect(patched.json()).toMatchObject({ name: 'Reise', color: 'sky', usage: 1 })
    // Renaming alone keeps the color.
    expect((await call('PATCH', `/api/tags/${urlaub.id}`, { name: 'Reise' })).json()).toMatchObject(
      {
        color: 'sky',
      },
    )
    expect((await call('GET', '/api/tags')).json()).toEqual([
      { id: urlaub.id, name: 'Reise', color: 'sky', usage: 1 },
    ])
  })

  it('rejects duplicates ignoring case and bad names', async () => {
    await call('POST', '/api/tags', { name: 'Steuer' })
    expect((await call('POST', '/api/tags', { name: 'steuer' })).statusCode).toBe(409)
    expect((await call('POST', '/api/tags', { name: '' })).statusCode).toBe(400)
    expect((await call('POST', '/api/tags', { name: 'x'.repeat(41) })).statusCode).toBe(400)
    const list = (await call('GET', '/api/tags')).json() as TagDto[]
    const reise = list.find((item) => item.name === 'Reise')!
    expect((await call('PATCH', `/api/tags/${reise.id}`, { name: 'STEUER' })).statusCode).toBe(409)
  })

  it('deletes a tag and its links but keeps the bookings', async () => {
    const db = app.get<AppDatabase>(DB)
    const before = db.select({ id: transaction.id }).from(transaction).all().length
    const reise = ((await call('GET', '/api/tags')).json() as TagDto[]).find(
      (item) => item.name === 'Reise',
    )!
    expect((await call('DELETE', `/api/tags/${reise.id}`)).statusCode).toBe(204)
    expect(
      db.select().from(transactionTag).where(eq(transactionTag.tagId, reise.id)).all(),
    ).toEqual([])
    expect(db.select({ id: transaction.id }).from(transaction).all()).toHaveLength(before)
    expect((await call('DELETE', `/api/tags/${reise.id}`)).statusCode).toBe(404)
  })
})
