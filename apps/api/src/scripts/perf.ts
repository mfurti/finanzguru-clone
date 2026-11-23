/**
 * Performance check (SC-002, T075): `pnpm --filter api perf`
 * 1. Seeds a temporary DB with 5 years of daily history and ~10k transactions.
 * 2. Times every API call the overview page makes.
 * 3. Uploads and imports a generated 50,000-row Sparkasse CSV.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runMigrations } from '../database/migrate'
import { openDatabase } from '../database/open-database'
import { seedPerf } from '../database/perf-seed'

const OVERVIEW_CALLS = [
  '/api/dashboard/layout',
  '/api/overview/net-worth?period=1Y',
  '/api/overview/net-worth?period=ALL',
  '/api/overview/allocation',
  '/api/overview/kpis?period=1Y',
  '/api/overview/holdings/top-flop?range=1D',
  '/api/accounts/tree',
  '/api/transactions/unreviewed/count',
  '/api/cashflow/summary',
  '/api/budgets',
]

function sparkasseCsv(rows: number): Buffer {
  const header =
    '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"Betrag";"Waehrung";"Info"'
  const lines = [header]
  for (let i = 0; i < rows; i++) {
    const day = String((i % 28) + 1).padStart(2, '0')
    const month = String((Math.floor(i / 28) % 12) + 1).padStart(2, '0')
    const year = 22 + (Math.floor(i / 336) % 4)
    lines.push(
      `"DE45120300001234567890";"${day}.${month}.${year}";"${day}.${month}.${year}";"KARTENZAHLUNG";"Einkauf ${i}";"Laden ${i % 300}";"";"-${(i % 9000) + 1},${String(i % 100).padStart(2, '0')}";"EUR";"Umsatz gebucht"`,
    )
  }
  return Buffer.from(lines.join('\r\n'), 'latin1')
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'finance-perf-'))
  process.env.DATABASE_PATH = join(dir, 'perf.db')
  process.env.NODE_ENV = 'test'
  process.env.API_SESSION_SECRET ??= 'perf-session-secret-0123456789abcdef'
  process.env.API_ENCRYPTION_KEY ??= Buffer.alloc(32, 5).toString('base64')
  process.env.COOKIE_SECURE = 'false'
  process.env.LOGIN_RATE_LIMIT = '100'

  const sqlite = openDatabase(process.env.DATABASE_PATH)
  const db = drizzle({ client: sqlite })
  runMigrations(db)
  let t = performance.now()
  const seeded = seedPerf(db)
  console.log(
    `seed: ${seeded.transactions} transactions, ${seeded.prices} prices in ${Math.round(performance.now() - t)} ms`,
  )
  sqlite.close()

  const { AppModule } = await import('../app.module.js')
  const { configureApp } = await import('../app.setup.js')
  const { AuthService } = await import('../modules/auth/auth.service.js')
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  })
  await configureApp(app)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  await app.get(AuthService).setOwner('Perf', 'perf-password-123')
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password: 'perf-password-123' },
  })
  const cookie = String(login.headers['set-cookie']).split(';')[0]!

  // Warm-up, then time each overview call on its own (sum = worst case without parallelism).
  await app.inject({ method: 'GET', url: OVERVIEW_CALLS[1]!, headers: { cookie } })
  t = performance.now()
  const timings: (readonly [string, number])[] = []
  for (const url of OVERVIEW_CALLS) {
    const start = performance.now()
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    if (res.statusCode !== 200) throw new Error(`${url} -> ${res.statusCode}`)
    timings.push([url, Math.round(performance.now() - start)])
  }
  const overviewMs = Math.round(performance.now() - t)
  for (const [url, ms] of timings) console.log(`  ${String(ms).padStart(5)} ms  ${url}`)
  console.log(`overview API total: ${overviewMs} ms`)

  const csv = sparkasseCsv(50_000)
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(csv)]), 'perf.csv')
  const response = new Response(form)
  t = performance.now()
  const upload = await app.inject({
    method: 'POST',
    url: '/api/import/csv',
    headers: { cookie, 'content-type': response.headers.get('content-type')! },
    payload: Buffer.from(await response.arrayBuffer()),
  })
  const { jobId } = upload.json() as { jobId: string }
  const confirm = await app.inject({
    method: 'POST',
    url: `/api/import/csv/${jobId}/confirm`,
    headers: { cookie },
    payload: {},
  })
  const importMs = Math.round(performance.now() - t)
  const job = confirm.json() as { status: string; imported: number }
  console.log(`csv import 50k rows: ${job.status}, ${job.imported} imported in ${importMs} ms`)

  await app.close()
  const ok = overviewMs < 2000 && importMs < 30_000 && job.imported === 50_000
  console.log(ok ? 'PASS' : 'FAIL')
  process.exitCode = ok ? 0 : 1
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
