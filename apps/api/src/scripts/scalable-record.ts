/**
 * Dev CLI (004 T006): `pnpm --filter api scalable:record`
 * Uses the stored Scalable grant of the local database, lists the tools with
 * their input schemas and calls every allowlisted read tool once. Raw output
 * goes to `data/scalable-raw/` (git-ignored, contains personal data); the
 * anonymized fixtures in `test/fixtures/scalable-mcp/` are made from it.
 * Only read tools on the allowlist can be called (ReadOnlyToolGuard).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { CryptoService } from '../common/crypto.service'
import { openDatabase } from '../database/open-database'
import { READ_TOOLS } from '../modules/sources/scalable-mcp/allowlist'
import { ScalableMcpClient } from '../modules/sources/scalable-mcp/client'
import { ScalableCredentialStore } from '../modules/sources/scalable-mcp/credential-store'
import { ScalableOAuthProvider } from '../modules/sources/scalable-mcp/oauth-provider'

const env = (key: string) => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} missing`)
  return value
}

function text(result: unknown): unknown {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? []
  const first = content.find((item) => item.type === 'text')?.text
  if (!first) return result
  try {
    return JSON.parse(first)
  } catch {
    return first
  }
}

async function main(): Promise<void> {
  const out = join(process.cwd(), 'data', 'scalable-raw')
  mkdirSync(out, { recursive: true })
  const db = drizzle({ client: openDatabase(process.env.DATABASE_PATH ?? './data/app.db') })
  const config = { getOrThrow: env, get: (key: string) => process.env[key] } as ConfigService
  const store = new ScalableCredentialStore(db, new CryptoService(config))
  const provider = new ScalableOAuthProvider(store, env('SCALABLE_REDIRECT_URI'))
  const client = new ScalableMcpClient(
    new URL(process.env.SCALABLE_MCP_URL ?? 'https://mcp.scalable.capital/mcp'),
    provider,
  )

  const connected = await client.connect()
  if (connected.status !== 'connected') throw new Error('Not connected – connect in the app first')

  // Full tool list incl. input schemas (the manifest in the DB keeps only names/descriptions).
  const raw = (client as unknown as { client: { listTools: () => Promise<{ tools: unknown[] }> } })
    .client
  const listed = await raw.listTools()
  writeFileSync(join(out, 'tools-list.json'), JSON.stringify(listed, null, 2))
  await client.discover()

  const save = (name: string, value: unknown) =>
    writeFileSync(join(out, `${name}.json`), JSON.stringify(value, null, 2))
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    try {
      const value = text(await client.call(name, args))
      save(name, value)
      console.log(`ok   ${name}`)
      return value
    } catch (error) {
      save(name, { error: error instanceof Error ? error.message : String(error) })
      console.log(`fail ${name}: ${error instanceof Error ? error.message : error}`)
      return null
    }
  }

  await call('get_account_profile')
  const portfolios = (await call('list_accessible_portfolios')) as {
    portfolios?: { portfolioId?: string; id?: string }[]
  } | null
  const portfolioId =
    portfolios?.portfolios?.[0]?.portfolioId ?? portfolios?.portfolios?.[0]?.id ?? undefined
  const scoped = portfolioId ? { portfolioId } : {}
  await call('get_portfolio_overview', scoped)
  await call('get_portfolio_holdings', scoped)
  await call('get_portfolio_cash_breakdown', scoped)
  // Full history, all pages (100 per page), merged into one file.
  const all: unknown[] = []
  let cursor: string | undefined
  let pages = 0
  do {
    const page = (await call('list_portfolio_transactions', {
      ...scoped,
      pageSize: 100,
      ...(cursor ? { cursor } : {}),
    })) as { transactions?: unknown[]; page?: { nextCursor?: string | null } } | null
    all.push(...(page?.transactions ?? []))
    cursor = page?.page?.nextCursor ?? undefined
    pages++
  } while (cursor && pages < 200)
  save('list_portfolio_transactions', {
    portfolioId,
    page: { nextCursor: null, totalCount: all.length, returnedCount: all.length },
    transactions: all,
  })
  console.log(`     ${all.length} transactions in ${pages} page(s)`)
  await call('get_overnight_summary')
  await call('list_overnight_transactions')

  const notCalled = [...READ_TOOLS].filter(
    (name) =>
      ![
        'get_account_profile',
        'list_accessible_portfolios',
        'get_portfolio_overview',
        'get_portfolio_holdings',
        'get_portfolio_cash_breakdown',
        'list_portfolio_transactions',
        'get_overnight_summary',
        'list_overnight_transactions',
      ].includes(name),
  )
  if (notCalled.length) console.log(`not called: ${notCalled.join(', ')}`)
  await client.close()
  console.log(`raw responses in ${out} (git-ignored, personal data)`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
