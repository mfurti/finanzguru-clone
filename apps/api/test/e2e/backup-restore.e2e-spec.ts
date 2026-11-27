import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DB } from '../../src/database/database.constants'
import { seedDemo } from '../../src/database/demo'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { loginCookie } from '../helpers/auth'
import { multipartBody } from '../helpers/multipart'
import { createTestApp } from '../helpers/test-app'

// ConfigModule validates DATABASE_PATH when the app module is imported: set a file DB first.
const dir = await vi.hoisted(async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-e2e-'))
  process.env.DATABASE_PATH = path.join(folder, 'app.db')
  return folder
})

/** 014 T006: backup → change data → restore → restart → identical data. */
describe('backup restore round trip (014)', () => {
  const env = {
    DATABASE_PATH: join(dir, 'app.db'),
    LOGOS_DIR: join(dir, 'logos'),
    BRAND_LOGOS_DIR: join(dir, 'brand-logos'),
  }
  let app: NestFastifyApplication | undefined

  afterEach(async () => {
    await app?.close()
    app = undefined
  })

  const start = async () => {
    app = await createTestApp({}, env)
    return { app, cookie: await loginCookie(app) }
  }
  const figures = (db: AppDatabase) =>
    db.$client.prepare('SELECT count(*) AS n, sum(amount_cents) AS s FROM transactions').get() as {
      n: number
      s: number
    }
  const upload = async (target: NestFastifyApplication, cookie: string, zip: Buffer) => {
    const body = await multipartBody(zip, 'backup.zip')
    return target.inject({
      method: 'POST',
      url: '/api/backup/restore',
      headers: { cookie, ...body.headers },
      payload: body.payload,
    })
  }

  it('restores the backed-up data on the next start', async () => {
    let { app: running, cookie } = await start()
    const db = running.get<AppDatabase>(DB)
    seedDemo(db)
    const before = figures(db)
    expect(before.n).toBeGreaterThan(0)
    const backup = await running.inject({ method: 'GET', url: '/api/backup', headers: { cookie } })
    expect(backup.statusCode).toBe(200)

    // Change the data after the backup.
    db.$client
      .prepare('DELETE FROM transactions WHERE rowid IN (SELECT rowid FROM transactions LIMIT 5)')
      .run()
    expect(figures(db).n).toBe(before.n - 5)

    const staged = await upload(running, cookie, backup.rawPayload)
    expect(staged.statusCode).toBe(202)
    const pending = await running.inject({
      method: 'GET',
      url: '/api/backup/restore',
      headers: { cookie },
    })
    expect(pending.json().pending.app).toBe('vermoegenskompass')
    // Nothing changes until the restart.
    expect(figures(db).n).toBe(before.n - 5)

    await running.close()
    ;({ app: running, cookie } = await start())
    expect(figures(running.get<AppDatabase>(DB))).toEqual(before)
    const after = await running.inject({
      method: 'GET',
      url: '/api/backup/restore',
      headers: { cookie },
    })
    expect(after.json().pending).toBeNull()
    // The replaced database is kept next to the new one.
    expect(readdirSync(dir).some((name) => name.startsWith('app.db.before-restore-'))).toBe(true)
  })

  it('refuses files that are no backup of this app or from a newer version', async () => {
    const { app: running, cookie } = await start()
    expect((await upload(running, cookie, Buffer.from('kein zip'))).statusCode).toBe(400)

    const backup = await running.inject({ method: 'GET', url: '/api/backup', headers: { cookie } })
    const files = unzipSync(new Uint8Array(backup.rawPayload))
    const manifest = JSON.parse(Buffer.from(files['manifest.json']!).toString('utf8'))
    const newer = zipSync({
      ...files,
      'manifest.json': strToU8(
        JSON.stringify({ ...manifest, migration: { idx: 999, tag: '0999_future' } }),
      ),
    })
    const refused = await upload(running, cookie, Buffer.from(newer))
    expect(refused.statusCode).toBe(400)
    expect(refused.json().statusMessage ?? refused.json().message).toMatch(/neueren App-Version/)

    const noDb = zipSync({ 'manifest.json': files['manifest.json']! })
    expect((await upload(running, cookie, Buffer.from(noDb))).statusCode).toBe(400)
    expect(existsSync(join(dir, 'restore'))).toBe(false)
  })

  it('cancels a staged restore', async () => {
    const { app: running, cookie } = await start()
    const backup = await running.inject({ method: 'GET', url: '/api/backup', headers: { cookie } })
    expect((await upload(running, cookie, backup.rawPayload)).statusCode).toBe(202)
    const cancelled = await running.inject({
      method: 'DELETE',
      url: '/api/backup/restore',
      headers: { cookie },
    })
    expect(cancelled.statusCode).toBe(204)
    expect(existsSync(join(dir, 'restore'))).toBe(false)
  })
})
