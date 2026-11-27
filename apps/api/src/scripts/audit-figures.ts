/**
 * Owner audit (010 T001, dividends 012 T001): `pnpm --filter api audit:figures -- --accounts <id,id,…> [--period 1Y]`
 *
 * Boots the API in-process against the local database (DATABASE_PATH from `.env`), logs in
 * with the local dev password (`AUDIT_PASSWORD` or `data/dev-login.txt`) and prints the figures
 * of spec 010 section A for the chosen accounts. It writes nothing; copy values into the
 * git-ignored `data/audit-010-local.md` by hand – never into the repository.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { createFastifyAdapter } from '../app.setup'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function password(): string {
  if (process.env.AUDIT_PASSWORD) return process.env.AUDIT_PASSWORD
  const file = join(process.cwd(), 'data', 'dev-login.txt')
  const match = existsSync(file) ? /^Password:\s*(\S+)/m.exec(readFileSync(file, 'utf8')) : null
  if (!match)
    throw new Error('Set AUDIT_PASSWORD or create data/dev-login.txt (owner:set-password)')
  return match[1]!
}

const euro = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? '–'
    : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const pct = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '–' : `${(Number(value) * 100).toFixed(2)} %`

async function main(): Promise<void> {
  const accounts = arg('accounts')
  if (!accounts) throw new Error('Usage: audit:figures -- --accounts <id,id,…> [--period 1Y]')
  const period = arg('period') ?? '1Y'
  process.env.LOG_LEVEL ??= 'silent'
  const { AppModule } = await import('../app.module.js')
  const { configureApp } = await import('../app.setup.js')
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(), {
    logger: ['error'],
  })
  await configureApp(app)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password: password() },
  })
  if (login.statusCode >= 300) throw new Error(`Login failed (${login.statusCode})`)
  const cookie = String(login.headers['set-cookie']).split(';')[0]!
  const get = async <T>(url: string): Promise<T> => {
    const res = await app.inject({ url, headers: { cookie } })
    if (res.statusCode >= 300) throw new Error(`${url} → ${res.statusCode}`)
    return res.json() as T
  }
  const q = `accounts=${encodeURIComponent(accounts)}`

  type NetWorth = { totalCents: number; gainCents: number; gainPct: string | null }
  type Allocation = { totalCents: number }
  type Kpis = {
    investedCents: number
    priceGain: { cents: number; pct: string | null }
    realized: { grossCents: number; netCents: number; pct: string | null }
    interest: { grossCents: number }
    dividends: { grossCents: number }
    taxesFeesCents: number
    totalReturnCents: number
    twror: string | null
    irr: string | null
    inflation: string | null
    realReturn: string | null
  }
  type Position = {
    name: string
    quantity: string
    valueCents: number
    entryValueCents: number
    avgPrice: string
    gainCents: number
    gainPct: string
  }
  type Cashflow = {
    period: { label: string }
    incomeCents: number
    expenseCents: number
    balanceCents: number
    savedCents: number
    savingsRate: string | null
  }
  type Categories = {
    totalCents: number
    items: { name: string; count: number; totalCents: number }[]
  }

  const netWorth = await get<NetWorth>(`/api/overview/net-worth?period=${period}&mode=value&${q}`)
  const allocation = await get<Allocation>(`/api/overview/allocation?${q}`)
  const kpis = await get<Kpis>(`/api/overview/kpis?period=${period}&${q}`)
  const positions = await get<Position[]>(`/api/investments/positions?${q}`)
  const cashflow = await get<Cashflow>(`/api/cashflow/summary?${q}&granularity=month`)
  const categories = await get<Categories>(
    `/api/cashflow/categories?${q}&granularity=month&kind=expense`,
  )
  const unreviewed = await get<{ count: number }>(`/api/transactions/unreviewed/count?${q}`)
  type Dividends = {
    last12Cents: number
    years: { year: number; cents: number; changePct: string | null }[]
    bySecurity: { name: string; cents: number }[]
  }
  const dividends = await get<Dividends>(`/api/dividends/summary?${q}`)

  const rows: [string, string][] = [
    ['A1 Gesamtvermögen (Chart)', euro(netWorth.totalCents)],
    ['A1 Gesamtvermögen (Aufteilung)', euro(allocation.totalCents)],
    [`A2 Gewinn (${period})`, `${euro(netWorth.gainCents)} (${pct(netWorth.gainPct)})`],
    ['A3 Investiertes Kapital', euro(kpis.investedCents)],
    ['A4 Kursgewinn', `${euro(kpis.priceGain.cents)} (${pct(kpis.priceGain.pct)})`],
    [
      'A5 Realisierte Gewinne brutto / netto',
      `${euro(kpis.realized.grossCents)} / ${euro(kpis.realized.netCents)} (${pct(kpis.realized.pct)})`,
    ],
    ['A6 Steuern & Gebühren', euro(kpis.taxesFeesCents)],
    [
      '   Zinsen / Dividenden',
      `${euro(kpis.interest.grossCents)} / ${euro(kpis.dividends.grossCents)}`,
    ],
    ['A7 Gesamtertrag', euro(kpis.totalReturnCents)],
    ['A8 TWROR / IZF', `${pct(kpis.twror)} / ${pct(kpis.irr)}`],
    ['A9 Inflation / Realrendite', `${pct(kpis.inflation)} / ${pct(kpis.realReturn)}`],
    ...positions.map((p): [string, string] => [
      `A10 ${p.name}`,
      `${p.quantity} St., Wert ${euro(p.valueCents)}, Einstieg ${euro(p.entryValueCents)} (⌀ ${p.avgPrice}), Gewinn ${euro(p.gainCents)} (${pct(p.gainPct)})`,
    ]),
    [`A12 Einnahmen ${cashflow.period.label}`, euro(cashflow.incomeCents)],
    ['A12 Ausgaben', euro(-cashflow.expenseCents)],
    ['A13 Gespart', euro(cashflow.savedCents)],
    ['A14 Saldo', euro(cashflow.balanceCents)],
    ['A15 Sparquote', pct(cashflow.savingsRate)],
    [
      'A16 Nicht kategorisiert',
      String(categories.items.find((item) => item.name === 'Nicht kategorisiert')?.count ?? 0),
    ],
    ['A17 Ungeprüfte Transaktionen', String(unreviewed.count)],
    ['D1 Dividenden letzte 12 Monate', euro(dividends.last12Cents)],
    ...dividends.years.map((y): [string, string] => [
      `D2 Dividenden ${y.year}`,
      `${euro(y.cents)} (${pct(y.changePct)})`,
    ]),
    ...dividends.bySecurity.map((row): [string, string] => [`D3 ${row.name}`, euro(row.cents)]),
  ]
  const width = Math.max(...rows.map(([label]) => label.length))
  for (const [label, value] of rows) console.log(`${label.padEnd(width)}  ${value}`)
  await app.close()
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
