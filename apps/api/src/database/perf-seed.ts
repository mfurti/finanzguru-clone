/**
 * Synthetic load dataset for SC-002: 5 years of daily prices for 10 ETFs and
 * about 10,000 cash transactions plus monthly savings-plan buys.
 */
import { RecomputeService } from '../modules/import/recompute.service'
import { D, valueCents } from '../domain/money'
import { addDays, addMonths, eachDay, todayIso } from '../domain/period'
import type { AppDatabase } from './drizzle.module'
import { account, institution, instrument, price, transaction } from './schema'
import { seedDefaults } from './seed'

/** Valid ISINs (checksum) for the load test instruments. */
const ISINS = [
  'IE00B4L5Y983',
  'IE00BKM4GZ66',
  'IE00B3RBWM25',
  'IE00BK5BQT80',
  'LU0274208692',
  'IE00B5BMR087',
  'IE00BFMXXD54',
  'IE00B52VJ196',
  'DE0005933931',
  'IE00B6R52259',
]

export function seedPerf(
  db: AppDatabase,
  today = todayIso(),
  transactions = 10_000,
): { transactions: number; prices: number } {
  seedDefaults(db)
  const start = addMonths(today, -60)
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  return db.transaction((tx) => {
    const inst = tx.insert(institution).values({ name: 'Perf Bank' }).returning().get().id
    const depot = tx
      .insert(account)
      .values({ institutionId: inst, name: 'Perf Depot', type: 'depot' })
      .returning()
      .get().id
    const giro = tx
      .insert(account)
      .values({ institutionId: inst, name: 'Perf Giro', type: 'checking', balanceCents: 500_000 })
      .returning()
      .get().id

    const priceRows: (typeof price.$inferInsert)[] = []
    const ids: string[] = []
    const closes = new Map<string, Map<string, string>>()
    ISINS.forEach((isin, index) => {
      const id = tx
        .insert(instrument)
        .values({ isin, name: `Perf ETF ${index + 1}`, assetClass: 'etf' })
        .returning()
        .get().id
      ids.push(id)
      const series = new Map<string, string>()
      let level = 50 + index * 10
      for (const day of eachDay(start, today)) {
        const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
        if (weekday === 0 || weekday === 6) continue
        level = Math.max(1, level * (1.0003 + (random() - 0.5) * 0.02))
        const close = new D(level).toDecimalPlaces(2).toString()
        series.set(day, close)
        priceRows.push({ instrumentId: id, date: day, close, source: 'manual' })
      }
      closes.set(id, series)
    })
    for (let i = 0; i < priceRows.length; i += 1000)
      tx.insert(price)
        .values(priceRows.slice(i, i + 1000))
        .run()

    const rows: (typeof transaction.$inferInsert)[] = []
    const days = eachDay(start, today)
    for (let n = 0; n < transactions; n++) {
      const day = days[Math.floor(random() * days.length)]!
      const income = n % 25 === 0
      rows.push({
        accountId: giro,
        bookingDate: day,
        amountCents: income ? 250_000 : -Math.round(500 + random() * 15_000),
        type: income ? 'income' : 'expense',
        counterparty: `Perf Partner ${n % 200}`,
        purpose: `Buchung ${n}`,
        source: 'manual',
        fingerprint: `perf-${n}`,
      })
    }
    for (let month = 0; month < 60; month++) {
      const first = addDays(addMonths(start, month), 1)
      ids.forEach((id, index) => {
        let day = first
        while (!closes.get(id)!.has(day) && day <= today) day = addDays(day, 1)
        const close = closes.get(id)!.get(day)
        if (!close) return
        const quantity = new D(100).dividedBy(close).toDecimalPlaces(6, D.ROUND_DOWN).toString()
        rows.push({
          accountId: depot,
          bookingDate: day,
          amountCents: -valueCents(quantity, close),
          type: 'buy',
          instrumentId: id,
          quantity,
          unitPrice: close,
          source: 'manual',
          fingerprint: `perf-buy-${month}-${index}`,
        })
      })
    }
    for (let i = 0; i < rows.length; i += 500)
      tx.insert(transaction)
        .values(rows.slice(i, i + 500))
        .run()

    new RecomputeService().recompute(tx, [depot, giro], undefined, today)
    return { transactions: rows.length, prices: priceRows.length }
  })
}
