import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import Database from 'better-sqlite3'
import { unzipSync } from 'fflate'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { latestMigration } from '../../src/common/app-version'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import type { BackupManifest } from '../../src/modules/backup/backup.service'
import { createDemoApp } from '../helpers/demo-app'

/** 014 T005: backup download. */
describe('backup download (014)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
    writeFileSync(join(process.env.LOGOS_DIR!, 'eigenes.png'), Buffer.from([1, 2, 3]))
  })

  afterAll(async () => {
    await app?.close()
  })

  it('needs the owner session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/backup' })).statusCode).toBe(401)
  })

  it('returns a zip with manifest, database snapshot and logos', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/backup', headers: { cookie } })
    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('application/zip')
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="vermoegenskompass-backup-\d{4}-\d{2}-\d{2}\.zip"/,
    )
    const files = unzipSync(new Uint8Array(response.rawPayload))
    const manifest = JSON.parse(
      Buffer.from(files['manifest.json']!).toString('utf8'),
    ) as BackupManifest
    expect(manifest.app).toBe('vermoegenskompass')
    expect(manifest.migration).toEqual(latestMigration())
    expect([...files['logos/eigenes.png']!]).toEqual([1, 2, 3])

    // The snapshot holds the same data as the live database.
    const path = join(mkdtempSync(join(tmpdir(), 'backup-check-')), 'app.sqlite')
    writeFileSync(path, files['app.sqlite']!)
    const snapshot = new Database(path, { readonly: true })
    const live = app.get<AppDatabase>(DB).$client
    for (const table of ['account', 'transactions', 'category', 'price']) {
      const count = (db: Database.Database) =>
        (db.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n
      expect(count(snapshot)).toBe(count(live))
      expect(count(live)).toBeGreaterThan(0)
    }
    const sum = (db: Database.Database) =>
      (db.prepare('SELECT sum(amount_cents) AS s FROM transactions').get() as { s: number }).s
    expect(sum(snapshot)).toBe(sum(live))
    snapshot.close()
  })
})
