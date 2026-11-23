import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { instrument, price } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { multipartBody } from '../helpers/multipart'
import { createTestApp } from '../helpers/test-app'

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures/csv', name))

describe('price list import (T009)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let benchmarkId: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
    db = app.get<AppDatabase>(DB)
    benchmarkId = db
      .insert(instrument)
      .values({ isin: 'IE00B5BMR087', name: 'S&P 500', assetClass: 'etf', isBenchmark: true })
      .returning()
      .get().id
    db.insert(instrument).values({ isin: 'IE00B4L5Y983', name: 'World', assetClass: 'etf' }).run()
  })

  afterAll(async () => {
    await app?.close()
  })

  async function upload(name: string): Promise<string> {
    const { payload, headers } = await multipartBody(fixture(name), name)
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/csv',
      headers: { ...headers, cookie },
      payload,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ detectedFormat: 'price-list', needsMapping: false })
    return res.json().jobId as string
  }

  const confirm = (jobId: string, payload: object = {}) =>
    app.inject({
      method: 'POST',
      url: `/api/import/csv/${jobId}/confirm`,
      headers: { cookie },
      payload,
    })

  it('needs an instrument when the file has no ISIN column', async () => {
    const jobId = await upload('price-list.csv')
    expect((await confirm(jobId)).statusCode).toBe(400)
    const res = await confirm(jobId, { instrumentId: benchmarkId })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'partial', imported: 3, skipped: 0, failed: 2 })
    const rows = db.select().from(price).where(eq(price.instrumentId, benchmarkId)).all()
    expect(rows.map((r) => r.source)).toEqual(['csv', 'csv', 'csv'])
  })

  it('maps rows by ISIN, updates changed days and skips unchanged ones', async () => {
    const res = await confirm(await upload('price-list-isin.csv'))
    expect(res.json()).toMatchObject({ status: 'partial', imported: 3, skipped: 0 })
    // Unknown ISIN (valid checksum, no instrument) and invalid ISIN are reported per line.
    expect(res.json().errors).toEqual(
      expect.arrayContaining([
        { line: 5, reason: 'Ungültige ISIN' },
        { line: 6, reason: 'Wertpapier DE000A0F5UF5 unbekannt' },
      ]),
    )
    const again = await confirm(await upload('price-list-isin.csv'))
    expect(again.json()).toMatchObject({ imported: 0, skipped: 3 })
    expect(
      db
        .select()
        .from(price)
        .where(eq(price.instrumentId, benchmarkId))
        .all()
        .find((r) => r.date === '2026-01-02')!.close,
    ).toBe('500.1')
  })
})
