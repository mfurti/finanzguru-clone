import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { DividendCalendarEntry, DividendSummary } from '@finance/shared'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution, instrument, transaction } from '../../src/database/schema'
import { addDays, addMonths, todayIso } from '../../src/domain/period'
import { createDemoApp } from '../helpers/demo-app'

describe('Dividenden (US2)', () => {
  let app: NestFastifyApplication
  let cookie: string
  let db: AppDatabase
  let depotId: string
  let vwrlId: string

  beforeAll(async () => {
    let demo
    ;({ app, cookie, demo } = await createDemoApp())
    depotId = demo.depotId
    db = app.get<AppDatabase>(DB)
    vwrlId = db.select().from(instrument).where(eq(instrument.isin, 'IE00B3RBWM25')).get()!.id
  })

  afterAll(async () => {
    await app?.close()
  })

  const get = <T>(url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie } }).then((res) => {
      expect(res.statusCode, `${url}: ${res.body}`).toBe(200)
      return res.json() as T
    })
  const send = (method: 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, payload })

  it('counts only the selected depots (012 T008: the owner gap came from demo accounts)', async () => {
    const inst = db.insert(institution).values({ name: 'Zweitbroker' }).returning().get()
    const other = db
      .insert(account)
      .values({ institutionId: inst.id, name: 'Leeres Depot', type: 'depot' })
      .returning()
      .get()
    const own = await get<DividendSummary>(`/api/dividends/summary?accounts=${other.id}`)
    expect(own.years).toEqual([])
    expect(own.bySecurity).toEqual([])
    const demo = await get<DividendSummary>(`/api/dividends/summary?accounts=${depotId}`)
    expect(demo.years.length).toBeGreaterThan(0)
    const all = await get<DividendSummary>('/api/dividends/summary')
    expect(all.years).toEqual(demo.years)
  })

  it('splits by currency and reports the portfolio value (012 T009)', async () => {
    const summary = await get<DividendSummary>(`/api/dividends/summary?accounts=${depotId}`)
    const total = summary.bySecurity.reduce((sum, row) => sum + row.cents, 0)
    expect(summary.byCurrency.reduce((sum, row) => sum + row.cents, 0)).toBe(total)
    expect(summary.byCurrency.length).toBeGreaterThan(0)
    expect(summary.byCurrency.every((row) => row.label.length > 0)).toBe(true)
    expect(summary.portfolioValueCents).toBeGreaterThan(0)
  })

  it('sums the last 12 months to the cent (SC-003)', async () => {
    const today = todayIso()
    const from = addMonths(today, -12)
    const expected = db
      .select()
      .from(transaction)
      .where(and(eq(transaction.accountId, depotId), eq(transaction.type, 'dividend')))
      .all()
      .filter((tx) => tx.bookingDate > from && tx.bookingDate <= today)
      .reduce((sum, tx) => sum + tx.amountCents, 0)

    const summary = await get<DividendSummary>('/api/dividends/summary')
    expect(expected).toBeGreaterThan(0)
    expect(summary.last12Cents).toBe(expected)
    // Half-even rounding of sum / 12.
    expect(Math.abs(summary.avgPerMonthCents - expected / 12)).toBeLessThanOrEqual(0.5)
    expect(summary.bySecurity[0]).toMatchObject({ instrumentId: vwrlId, pct: '1' })
    const yearsTotal = summary.years.reduce((sum, y) => sum + y.cents, 0)
    const all = db
      .select()
      .from(transaction)
      .where(eq(transaction.type, 'dividend'))
      .all()
      .reduce((sum, tx) => sum + tx.amountCents, 0)
    expect(yearsTotal).toBe(all)
  })

  it('shows an expected payment with shares × amount per share, then hides it once received', async () => {
    const payDate = addDays(todayIso(), 20)
    const bad = await send('POST', '/api/dividends/expected', {
      instrumentId: vwrlId,
      payDate,
      exDate: addDays(payDate, 1),
      amountPerShare: '0.5',
    })
    expect(bad.statusCode).toBe(400)
    expect(
      (
        await send('POST', '/api/dividends/expected', {
          instrumentId: vwrlId,
          payDate,
          amountPerShare: '0',
        })
      ).statusCode,
    ).toBe(400)

    const created = await send('POST', '/api/dividends/expected', {
      instrumentId: vwrlId,
      payDate,
      amountPerShare: '0.5',
      note: 'Q4',
    })
    expect(created.statusCode).toBe(201)
    const id = created.json().id as string

    const calendar = await get<DividendCalendarEntry[]>('/api/dividends/calendar')
    const entry = calendar.find((e) => e.id === id)!
    expect(entry.status).toBe('expected')
    expect(entry.cents).toBeGreaterThan(0)
    expect(calendar.some((e) => e.status === 'received')).toBe(true)

    // A booked dividend in the same month replaces the expected entry.
    db.insert(transaction)
      .values({
        accountId: depotId,
        bookingDate: payDate,
        amountCents: 777,
        type: 'dividend',
        instrumentId: vwrlId,
        source: 'manual',
        fingerprint: 'e2e-dividend-received',
      })
      .run()
    const after = await get<DividendCalendarEntry[]>(
      `/api/dividends/calendar?to=${addMonths(payDate, 1)}`,
    )
    expect(after.find((e) => e.id === id)).toBeUndefined()
    expect(after.find((e) => e.date === payDate && e.status === 'received')!.cents).toBe(777)

    expect(
      (
        await send('PATCH', `/api/dividends/expected/${id}`, {
          instrumentId: vwrlId,
          payDate,
          amountPerShare: '0.6',
        })
      ).statusCode,
    ).toBe(200)
    expect((await send('DELETE', `/api/dividends/expected/${id}`)).statusCode).toBe(204)
    expect((await send('DELETE', `/api/dividends/expected/${id}`)).statusCode).toBe(404)
  })
})
