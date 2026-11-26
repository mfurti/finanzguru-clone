import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CsvUploadResponse, ImportJobDto } from '@finance/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loginCookie } from '../helpers/auth'
import { multipartBody } from '../helpers/multipart'
import { createTestApp } from '../helpers/test-app'

const fixture = (name: string) => readFileSync(join(__dirname, '../fixtures/csv', name))

describe('CSV import API', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  const upload = async (name: string, file = fixture(name)) => {
    const body = await multipartBody(file, name)
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/csv',
      headers: { ...body.headers, cookie },
      payload: body.payload,
    })
    expect(res.statusCode).toBe(201)
    return res.json() as CsvUploadResponse
  }

  const confirm = async (jobId: string, payload: object = {}) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/import/csv/${jobId}/confirm`,
      headers: { cookie },
      payload,
    })
    return res
  }

  it('V1: detects the Sparkasse layout and imports all rows', async () => {
    const uploaded = await upload('sparkasse-camt-v8.csv')
    expect(uploaded).toMatchObject({ detectedFormat: 'sparkasse-camt-v8', needsMapping: false })
    expect(uploaded.preview).toHaveLength(8)
    const res = await confirm(uploaded.jobId)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'succeeded', imported: 8 })
    const job = await app.inject({
      method: 'GET',
      url: `/api/import/jobs/${uploaded.jobId}`,
      headers: { cookie },
    })
    expect((job.json() as ImportJobDto).imported).toBe(8)
  })

  it('V2: re-uploading the same file imports nothing', async () => {
    const uploaded = await upload('sparkasse-camt-v8.csv')
    expect((await confirm(uploaded.jobId)).json()).toMatchObject({ imported: 0, skipped: 8 })
  })

  it('V3: reports malformed rows with line numbers', async () => {
    const uploaded = await upload('malformed.csv')
    const job = (await confirm(uploaded.jobId)).json() as ImportJobDto
    expect(job.status).toBe('partial')
    expect(job.errors.map((error) => error.line)).toEqual([3, 4])
  })

  it('V4: maps an unknown layout, saves the mapping and recognizes it next time', async () => {
    const accounts = (
      await app.inject({ method: 'GET', url: '/api/accounts', headers: { cookie } })
    ).json()
    const target = accounts[0].id as string

    const first = await upload('unknown-layout.csv')
    expect(first.needsMapping).toBe(true)
    expect(first.headers).toEqual(['Datum', 'Betrag', 'Empfaenger', 'Zweck', 'Kategorie'])
    expect((await confirm(first.jobId)).statusCode).toBe(400)

    const mapping = {
      delimiter: ',',
      encoding: 'utf-8',
      dateFormat: 'YYYY-MM-DD',
      decimalSeparator: '.',
      skipRows: 0,
      columns: { date: 0, amount: 1, counterparty: 2, purpose: 3 },
    }
    const done = await confirm(first.jobId, {
      accountId: target,
      mapping,
      saveMappingAs: 'Demo-Bank',
    })
    expect(done.json()).toMatchObject({ status: 'succeeded', imported: 3 })

    const again = await upload('unknown-layout.csv')
    expect(again).toMatchObject({ needsMapping: false, detectedFormat: 'mapping:Demo-Bank' })
    expect((await confirm(again.jobId)).json()).toMatchObject({ imported: 0, skipped: 3 })

    const mappings = await app.inject({
      method: 'GET',
      url: '/api/csv-mappings',
      headers: { cookie },
    })
    expect(mappings.json()).toHaveLength(1)
  })

  it('rejects non-CSV uploads, unknown jobs and double confirms', async () => {
    const body = await multipartBody(Buffer.from([0x00, 0x01, 0x02]), 'x.bin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/csv',
      headers: { ...body.headers, cookie },
      payload: body.payload,
    })
    expect(res.statusCode).toBe(400)
    expect((await confirm('missing')).statusCode).toBe(404)
  })

  it('requires a session', async () => {
    const body = await multipartBody(fixture('sparkasse-mt940.csv'), 'a.csv')
    const res = await app.inject({
      method: 'POST',
      url: '/api/import/csv',
      headers: body.headers,
      payload: body.payload,
    })
    expect(res.statusCode).toBe(401)
  })
})
