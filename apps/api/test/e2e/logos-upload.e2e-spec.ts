import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { TransactionPage } from '@finance/shared'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, transaction } from '../../src/database/schema'
import { LogosService } from '../../src/modules/logos/logos.service'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** Smallest valid PNG (1×1). */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082',
  'hex',
)

function multipart(content: Buffer, filename: string, type: string) {
  const boundary = '----logotest'
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

describe('own logo uploads (008 T013)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let accountId: string
  let dir: string
  const key = encodeURIComponent('bäckerei uploadtest')

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    dir = app.get(LogosService).logosDir()
    const db = app.get<AppDatabase>(DB)
    const inst = db.insert(institution).values({ name: 'Uploadbank' }).returning().get()
    accountId = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Upload-Giro', type: 'checking' })
      .returning()
      .get().id
    db.insert(transaction)
      .values({
        accountId,
        bookingDate: '2026-11-09',
        amountCents: -350,
        type: 'expense',
        source: 'manual',
        counterparty: 'Bäckerei Uploadtest',
        fingerprint: 'upload-1',
      })
      .run()
  })
  afterAll(() => app.close())

  const upload = (
    content: Buffer,
    filename = 'logo.png',
    type = 'image/png',
    withCookie = true,
  ) => {
    const body = multipart(content, filename, type)
    return app.inject({
      method: 'POST',
      url: `/api/logos/recipients/${key}/upload`,
      headers: { ...body.headers, ...(withCookie ? { cookie } : {}) },
      payload: body.payload,
    })
  }

  it('stores a PNG, shows it in the list and serves it to the owner only', async () => {
    const res = await upload(PNG)
    expect(res.statusCode).toBe(201)
    const url = (res.json() as { url: string }).url
    expect(url).toMatch(/^\/api\/logos\/files\/[0-9a-f-]{36}\.png$/)
    const item = (
      (await app
        .inject({ url: `/api/transactions?accounts=${accountId}`, headers: { cookie } })
        .then((r) => r.json())) as TransactionPage
    ).items[0]!
    expect(item).toMatchObject({ logo: { kind: 'upload', url }, logoSource: 'manual' })
    const file = await app.inject({ url, headers: { cookie } })
    expect(file.statusCode).toBe(200)
    expect(file.headers['content-type']).toBe('image/png')
    expect(file.headers['x-content-type-options']).toBe('nosniff')
    expect(file.rawPayload.equals(PNG)).toBe(true)
    expect((await app.inject({ url })).statusCode).toBe(401)
  })

  it('replacing and resetting delete the old file', async () => {
    const first = (await upload(PNG)).json() as { url: string }
    const second = (await upload(PNG)).json() as { url: string }
    const name = (url: string) => url.split('/').at(-1)!
    expect(existsSync(join(dir, name(first.url)))).toBe(false)
    expect(existsSync(join(dir, name(second.url)))).toBe(true)
    await app.inject({ method: 'DELETE', url: `/api/logos/recipients/${key}`, headers: { cookie } })
    expect(existsSync(join(dir, name(second.url)))).toBe(false)
    expect(readdirSync(dir)).toEqual([])
  })

  it('refuses big files, SVG and other types', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(300 * 1024)])
    const tooBig = await upload(big)
    expect(tooBig.statusCode).toBe(413)
    expect(tooBig.json()).toMatchObject({ statusMessage: 'Bild zu groß (max. 256 KB)' })
    const svg = await upload(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      'a.svg',
      'image/svg+xml',
    )
    expect(svg.statusCode).toBe(415)
    expect(svg.json()).toMatchObject({ statusMessage: 'Nur PNG, JPEG oder WebP' })
    // Declared as PNG, but the content is text.
    expect((await upload(Buffer.from('hallo'), 'fake.png')).statusCode).toBe(415)
    expect((await upload(PNG, 'logo.png', 'image/png', false)).statusCode).toBe(401)
  })

  it('serves only generated names', async () => {
    for (const name of ['..%2F..%2Fapp.db', 'x.png', '00000000-0000-0000-0000-000000000000.svg']) {
      const res = await app.inject({ url: `/api/logos/files/${name}`, headers: { cookie } })
      expect(res.statusCode).toBe(404)
    }
  })
})
