/**
 * Deterministic synthetic demo dataset (`db:seed --demo`). No real personal data.
 * One depot (3 ETFs, 2 stocks, one of them fully sold), a reference account
 * and a checking account with 3 years of daily prices and monthly bookings.
 * Values end on DEMO_END; later days carry the last prices forward.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { RecomputeService } from '../modules/import/recompute.service'
import { D, eurosToCents, valueCents } from '../domain/money'
import { addDays, addMonths, eachDay, todayIso } from '../domain/period'
import type { AppDatabase } from './drizzle.module'
import {
  account,
  category,
  customGroup,
  customGrouping,
  customGroupMember,
  exemptionOrder,
  expectedDividend,
  inflationRate,
  institution,
  instrument,
  instrumentWeight,
  price,
  taxYear,
  transaction,
  watchlist,
  watchlistEntry,
} from './schema'
import { seedDefaults } from './seed'

export const DEMO_END = '2026-11-20'
export const DEMO_START = addMonths(DEMO_END, -36)

interface DemoInstrument {
  isin: string
  wkn: string
  name: string
  assetClass: 'etf' | 'stock'
  start: number
  drift: number
  volatility: number
}

export const DEMO_INSTRUMENTS: readonly DemoInstrument[] = [
  {
    isin: 'IE00B4L5Y983',
    wkn: 'A0RPWH',
    name: 'iShares Core MSCI World UCITS ETF (Acc)',
    assetClass: 'etf',
    start: 78,
    drift: 0.00035,
    volatility: 0.009,
  },
  {
    isin: 'IE00BKM4GZ66',
    wkn: 'A111X9',
    name: 'iShares Core MSCI EM IMI UCITS ETF (Acc)',
    assetClass: 'etf',
    start: 28,
    drift: 0.0002,
    volatility: 0.011,
  },
  {
    isin: 'IE00B3RBWM25',
    wkn: 'A1JX52',
    name: 'Vanguard FTSE All-World UCITS ETF (Dist)',
    assetClass: 'etf',
    start: 98,
    drift: 0.0003,
    volatility: 0.009,
  },
  {
    isin: 'US0378331005',
    wkn: '865985',
    name: 'Apple Inc.',
    assetClass: 'stock',
    start: 165,
    drift: 0.0004,
    volatility: 0.016,
  },
  {
    isin: 'DE0007164600',
    wkn: '716460',
    name: 'SAP SE',
    assetClass: 'stock',
    start: 120,
    drift: 0.0005,
    volatility: 0.014,
  },
]

/** mulberry32: small seeded PRNG so every run produces the same data. */
function prng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isWeekday(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day !== 0 && day !== 6
}

/** First weekday on or after `date`. */
function weekdayOnOrAfter(date: string): string {
  let day = date
  while (!isWeekday(day)) day = addDays(day, 1)
  return day
}

export interface DemoResult {
  depotId: string
  referenceId: string
  checkingId: string
  transactions: number
  prices: number
}

type Db = AppDatabase

export function seedDemo(db: Db, today = todayIso()): DemoResult {
  seedDefaults(db)
  if (db.select().from(instrument).where(eq(instrument.isin, DEMO_INSTRUMENTS[0]!.isin)).get()) {
    throw new Error('Demo data is already present in this database')
  }
  const random = prng(20261120)

  return db.transaction((tx) => {
    const broker =
      tx
        .insert(institution)
        .values({ name: 'Demo Broker' })
        .onConflictDoNothing()
        .returning()
        .get() ?? tx.select().from(institution).where(eq(institution.name, 'Demo Broker')).get()!
    const bank =
      tx
        .insert(institution)
        .values({ name: 'Demo Bank' })
        .onConflictDoNothing()
        .returning()
        .get() ?? tx.select().from(institution).where(eq(institution.name, 'Demo Bank')).get()!

    const depotId = tx
      .insert(account)
      .values({ institutionId: broker.id, name: 'Demo Depot', type: 'depot', sortOrder: 1 })
      .returning()
      .get().id
    const referenceId = tx
      .insert(account)
      .values({
        institutionId: broker.id,
        name: 'Demo Referenzkonto',
        type: 'reference',
        parentAccountId: depotId,
        balanceCents: 18824,
        sortOrder: 2,
      })
      .returning()
      .get().id
    const checkingId = tx
      .insert(account)
      .values({
        institutionId: bank.id,
        name: 'Demo Girokonto',
        type: 'checking',
        iban: 'DE89370400440532013000',
        balanceCents: 437737,
        sortOrder: 3,
      })
      .returning()
      .get().id

    // Prices: weekday random walk per instrument.
    const instrumentIds = new Map<string, string>()
    const closes = new Map<string, Map<string, string>>()
    const priceRows: (typeof price.$inferInsert)[] = []
    for (const demo of DEMO_INSTRUMENTS) {
      const id = tx
        .insert(instrument)
        .values({
          isin: demo.isin,
          wkn: demo.wkn,
          name: demo.name,
          assetClass: demo.assetClass,
          fundType: demo.assetClass === 'etf' ? 'equity' : null,
        })
        .returning()
        .get().id
      instrumentIds.set(demo.isin, id)
      const series = new Map<string, string>()
      let level = demo.start
      for (const day of eachDay(DEMO_START, DEMO_END)) {
        if (!isWeekday(day)) continue
        const shock = (random() + random() + random() - 1.5) * 2 * demo.volatility
        level = Math.max(1, level * (1 + demo.drift + shock))
        const close = new D(level).toDecimalPlaces(2).toString()
        series.set(day, close)
        priceRows.push({ instrumentId: id, date: day, close, source: 'manual' })
      }
      closes.set(demo.isin, series)
    }
    for (let i = 0; i < priceRows.length; i += 1000)
      tx.insert(price)
        .values(priceRows.slice(i, i + 1000))
        .run()

    const categoryId = (main: string, sub?: string) => {
      const parent = tx
        .select()
        .from(category)
        .where(and(eq(category.name, main), isNull(category.parentId)))
        .get()!
      if (!sub) return parent.id
      return tx
        .select()
        .from(category)
        .where(and(eq(category.name, sub), eq(category.parentId, parent.id)))
        .get()!.id
    }
    const cat = {
      salary: categoryId('Einnahmen', 'Gehalt'),
      rent: categoryId('Wohnen', 'Miete / Wohngeld'),
      power: categoryId('Wohnen', 'Strom'),
      groceries: categoryId('Lebenshaltung', 'Lebensmittel und Getränke'),
      phone: categoryId('Lebenshaltung', 'Handy'),
      invest: categoryId('Sparen und Anlegen', 'Wertpapieranlage'),
      insurance: categoryId('Versicherung', 'Risiko-Lebensversicherung'),
      shopping: categoryId('Shopping und Unterhaltung', 'Kleidung'),
      leisure: categoryId('Freizeit, Hobbies und Soziales', 'Freizeitaktivitäten'),
    }

    const rows: (typeof transaction.$inferInsert)[] = []
    let n = 0
    const push = (row: Omit<typeof transaction.$inferInsert, 'fingerprint' | 'source'>) => {
      rows.push({
        ...row,
        source: 'manual',
        fingerprint: `demo-${String(++n).padStart(5, '0')}`,
        sourceRef: null,
      })
    }
    const trade = (
      type: 'buy' | 'sell',
      isin: string,
      date: string,
      quantity: string,
      feeCents = 0,
    ) => {
      const day = weekdayOnOrAfter(date)
      const close = closes.get(isin)!.get(day)!
      const gross = valueCents(quantity, close)
      push({
        accountId: depotId,
        bookingDate: day,
        type,
        instrumentId: instrumentIds.get(isin)!,
        quantity,
        unitPrice: close,
        feeCents,
        amountCents: type === 'buy' ? -(gross + feeCents) : gross - feeCents,
        counterparty: 'Demo Broker',
        purpose: `${type === 'buy' ? 'Kauf' : 'Verkauf'} ${isin}`,
        categoryId: cat.invest,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
    }
    const savingsPlan = (isin: string, date: string, euros: number) => {
      const day = weekdayOnOrAfter(date)
      const close = closes.get(isin)!.get(day)!
      trade(
        'buy',
        isin,
        day,
        new D(euros).dividedBy(close).toDecimalPlaces(6, D.ROUND_DOWN).toString(),
      )
    }

    // One-off stock purchases, SAP sold completely after ~20 months.
    trade('buy', 'US0378331005', addDays(DEMO_START, 3), '4', 100)
    trade('buy', 'DE0007164600', addDays(DEMO_START, 10), '5', 100)
    trade('sell', 'DE0007164600', addMonths(DEMO_START, 20), '5', 100)

    for (let month = 0; month < 36; month++) {
      const first = addMonths(DEMO_START.slice(0, 8) + '01', month + 1)
      if (first > DEMO_END) break
      savingsPlan('IE00B4L5Y983', addDays(first, 1), 150)
      savingsPlan('IE00BKM4GZ66', addDays(first, 1), 50)
      savingsPlan('IE00B3RBWM25', addDays(first, 1), 50)

      push({
        accountId: checkingId,
        bookingDate: addDays(first, -1),
        type: 'income',
        amountCents: 248000,
        counterparty: 'Demo Arbeitgeber GmbH',
        purpose: 'Gehalt',
        categoryId: cat.salary,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 2),
        type: 'expense',
        amountCents: -85000,
        counterparty: 'Demo Hausverwaltung',
        purpose: 'Miete',
        categoryId: cat.rent,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 4),
        type: 'expense',
        amountCents: -5000,
        counterparty: 'Demo Stadtwerke',
        purpose: 'Abschlag Strom',
        categoryId: cat.power,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 6),
        type: 'expense',
        amountCents: -4888,
        counterparty: 'Demo Mobilfunk',
        purpose: 'Handyrechnung',
        categoryId: cat.phone,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 14),
        type: 'expense',
        amountCents: -2362,
        counterparty: 'Demo Versicherung AG',
        purpose: 'Risiko-LV',
        categoryId: cat.insurance,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 1),
        type: 'transfer',
        amountCents: -25000,
        counterparty: 'Demo Referenzkonto',
        purpose: 'Sparplan',
        reviewStatus: 'reviewed',
      })
      // Discretionary spending keeps the monthly cash flow close to zero, so the
      // backwards-derived checking balance stays plausible over three years.
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 9),
        type: 'expense',
        amountCents: -eurosToCents(400 + Math.floor(random() * 400)),
        counterparty: 'Demo Modehaus',
        purpose: 'Einkauf',
        categoryId: cat.shopping,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      push({
        accountId: checkingId,
        bookingDate: addDays(first, 16),
        type: 'expense',
        amountCents: -eurosToCents(200 + Math.floor(random() * 160)),
        counterparty: 'Demo Freizeitpark',
        purpose: 'Freizeit',
        categoryId: cat.leisure,
        categorySource: 'manual',
        reviewStatus: 'reviewed',
      })
      for (let week = 0; week < 4; week++) {
        const amount = -eurosToCents(
          new D(45 + Math.floor(random() * 70)).plus(
            new D(Math.floor(random() * 100)).dividedBy(100),
          ),
        )
        // The last month stays unreviewed so the overview shows open items.
        const open = first >= addMonths(DEMO_END.slice(0, 8) + '01', 0)
        push({
          accountId: checkingId,
          bookingDate: addDays(first, 3 + week * 7),
          type: 'expense',
          amountCents: amount,
          counterparty: week % 2 === 0 ? 'Demo Supermarkt' : 'Demo Discounter',
          purpose: 'Einkauf',
          categoryId: open ? null : cat.groceries,
          categorySource: open ? null : 'manual',
          reviewStatus: open ? 'unreviewed' : 'reviewed',
        })
      }
      if (month % 3 === 2) {
        push({
          accountId: depotId,
          bookingDate: addDays(first, 20),
          type: 'dividend',
          instrumentId: instrumentIds.get('IE00B3RBWM25')!,
          amountCents: 150 + month * 20,
          counterparty: 'Demo Broker',
          purpose: 'Ausschüttung IE00B3RBWM25',
          reviewStatus: 'reviewed',
        })
      }
    }

    const visible = rows.filter((row) => row.bookingDate <= DEMO_END)
    for (let i = 0; i < visible.length; i += 500)
      tx.insert(transaction)
        .values(visible.slice(i, i + 500))
        .run()

    seedDemoAnalysis(tx, instrumentIds)
    seedDemoTaxes(tx, broker.id)
    seedDemoBenchmark(tx)

    new RecomputeService().recompute(
      tx,
      [depotId, referenceId, checkingId],
      undefined,
      today < DEMO_END ? DEMO_END : today,
    )
    return {
      depotId,
      referenceId,
      checkingId,
      transactions: visible.length,
      prices: priceRows.length,
    }
  })
}

/** Region/sector/currency weights, one grouping and inflation per year (feature 002, US1). */
const DEMO_WEIGHTS: Record<string, Record<'region' | 'sector' | 'currency', [string, string][]>> = {
  IE00B4L5Y983: {
    region: [
      ['north_america', '0.74'],
      ['europe', '0.16'],
      ['japan', '0.06'],
      ['pacific_ex_japan', '0.04'],
    ],
    sector: [
      ['information_technology', '0.26'],
      ['financials', '0.16'],
      ['health_care', '0.11'],
      ['consumer_discretionary', '0.1'],
      ['industrials', '0.11'],
    ],
    currency: [
      ['USD', '0.74'],
      ['EUR', '0.1'],
      ['JPY', '0.06'],
      ['GBP', '0.04'],
    ],
  },
  IE00BKM4GZ66: {
    region: [['emerging_markets', '1']],
    sector: [
      ['information_technology', '0.23'],
      ['financials', '0.22'],
      ['consumer_discretionary', '0.13'],
    ],
    currency: [
      ['CNY', '0.25'],
      ['INR', '0.2'],
      ['TWD', '0.19'],
      ['KRW', '0.11'],
      ['OTHER', '0.25'],
    ],
  },
  IE00B3RBWM25: {
    region: [
      ['north_america', '0.64'],
      ['europe', '0.15'],
      ['emerging_markets', '0.1'],
      ['japan', '0.06'],
      ['pacific_ex_japan', '0.05'],
    ],
    sector: [
      ['information_technology', '0.25'],
      ['financials', '0.16'],
      ['industrials', '0.11'],
    ],
    currency: [
      ['USD', '0.64'],
      ['EUR', '0.09'],
      ['JPY', '0.06'],
      ['OTHER', '0.21'],
    ],
  },
  US0378331005: {
    region: [['north_america', '1']],
    sector: [['information_technology', '1']],
    currency: [['USD', '1']],
  },
}

export const DEMO_INFLATION: Record<number, string> = {
  2023: '0.059',
  2024: '0.022',
  2025: '0.022',
}

function seedDemoAnalysis(tx: Pick<Db, 'insert'>, instrumentIds: Map<string, string>): void {
  const weights = Object.entries(DEMO_WEIGHTS).flatMap(([isin, dims]) =>
    (Object.entries(dims) as ['region' | 'sector' | 'currency', [string, string][]][]).flatMap(
      ([dimension, rows]) =>
        rows.map(([key, weight]) => ({
          instrumentId: instrumentIds.get(isin)!,
          dimension,
          key,
          weight,
        })),
    ),
  )
  tx.insert(instrumentWeight).values(weights).run()

  const grouping = tx.insert(customGrouping).values({ name: 'Kern/Satellit' }).returning().get()
  const kern = tx
    .insert(customGroup)
    .values({ groupingId: grouping.id, name: 'Kern', position: 0 })
    .returning()
    .get()
  const satellit = tx
    .insert(customGroup)
    .values({ groupingId: grouping.id, name: 'Satellit', position: 1 })
    .returning()
    .get()
  const members: [string, string][] = [
    ['IE00B4L5Y983', kern.id],
    ['IE00B3RBWM25', kern.id],
    ['IE00BKM4GZ66', satellit.id],
    ['US0378331005', satellit.id],
  ]
  tx.insert(customGroupMember)
    .values(
      members.map(([isin, groupId]) => ({
        groupingId: grouping.id,
        groupId,
        instrumentId: instrumentIds.get(isin)!,
      })),
    )
    .run()

  tx.insert(inflationRate)
    .values(Object.entries(DEMO_INFLATION).map(([year, rate]) => ({ year: Number(year), rate })))
    .run()

  // Next quarterly distribution of the demo's distributing ETF (US2).
  tx.insert(expectedDividend)
    .values({
      instrumentId: instrumentIds.get('IE00B3RBWM25')!,
      payDate: addDays(DEMO_END, 28),
      exDate: addDays(DEMO_END, 14),
      amountPerShare: '0.45',
      note: 'Quartalsausschüttung',
    })
    .run()
}

/** Demo tax settings (US4): Basiszins per year (demo values) and one exemption order at the broker. */
export const DEMO_BASE_RATES: Record<number, string> = {
  2024: '0.0229',
  2025: '0.0253',
  2026: '0.032',
}

function seedDemoTaxes(tx: Pick<Db, 'insert'>, brokerId: string): void {
  tx.insert(taxYear)
    .values(
      Object.entries(DEMO_BASE_RATES).map(([year, baseRate]) => ({
        year: Number(year),
        assessment: 'single' as const,
        baseRate,
      })),
    )
    .run()
  tx.insert(exemptionOrder)
    .values({ institutionId: brokerId, year: Number(DEMO_END.slice(0, 4)), amountCents: 80_000 })
    .run()
}

/** Benchmark for "Vergleichen mit" (US5), not held in the depot. */
export const DEMO_BENCHMARK = {
  isin: 'IE00B5BMR087',
  wkn: 'A0YEDG',
  name: 'iShares Core S&P 500 UCITS ETF (Acc)',
}

/**
 * Weekday closes from a smooth deterministic curve (no use of the demo's
 * random generator, so the other demo values stay unchanged).
 */
function seedDemoBenchmark(tx: Pick<Db, 'insert'>): void {
  const id = tx
    .insert(instrument)
    .values({ ...DEMO_BENCHMARK, assetClass: 'etf', fundType: 'equity', isBenchmark: true })
    .returning()
    .get().id
  const rows: (typeof price.$inferInsert)[] = []
  let i = 0
  for (const day of eachDay(DEMO_START, DEMO_END)) {
    if (!isWeekday(day)) continue
    const level =
      400 * Math.exp(0.0004 * i) * (1 + 0.04 * Math.sin(i / 23) + 0.015 * Math.sin(i / 5))
    rows.push({
      instrumentId: id,
      date: day,
      close: new D(level).toDecimalPlaces(2).toString(),
      source: 'manual',
    })
    i++
  }
  for (let start = 0; start < rows.length; start += 500) {
    tx.insert(price)
      .values(rows.slice(start, start + 500))
      .run()
  }

  // Demo watchlist (US6) with the benchmark.
  const list = tx.insert(watchlist).values({ name: 'Beobachten', position: 0 }).returning().get()
  tx.insert(watchlistEntry).values({ watchlistId: list.id, instrumentId: id, position: 0 }).run()
}
