/**
 * Dev CLI (005 T008): `pnpm --filter api enable-banking:record`
 * Uses the stored bank session of the local database and records account details, balances and
 * all transaction pages of the last 90 days. Raw output goes to `data/enable-banking-raw/`
 * (git-ignored, contains personal data); anonymized fixtures in
 * `test/fixtures/enable-banking/real/` are made from it. Only allowlisted read endpoints can be
 * called (EnableBankingClient).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { CryptoService } from '../common/crypto.service'
import { openDatabase } from '../database/open-database'
import { addDays } from '../domain/period'
import { fetchHttp } from '../modules/sources/enable-banking/client'
import { EnableBankingConnectionService } from '../modules/sources/enable-banking/enable-banking-connection.service'

async function main(): Promise<void> {
  const out = join(process.cwd(), 'data', 'enable-banking-raw')
  mkdirSync(out, { recursive: true })
  const db = drizzle({ client: openDatabase(process.env.DATABASE_PATH ?? './data/app.db') })
  const config = {
    get: (key: string) => process.env[key],
    getOrThrow: (key: string) => {
      const value =
        process.env[key] ??
        (key === 'ENABLE_BANKING_API_URL' ? 'https://api.enablebanking.com' : undefined)
      if (!value) throw new Error(`${key} missing`)
      return value
    },
  } as unknown as ConfigService
  const connection = new EnableBankingConnectionService(
    db,
    new CryptoService(config),
    config,
    fetchHttp,
  )
  const session = connection.session()
  if (!session) throw new Error('Not connected – connect the bank in the app first')
  const client = connection.client()
  const save = (name: string, value: unknown) =>
    writeFileSync(join(out, `${name}.json`), JSON.stringify(value, null, 2))
  const dateFrom = addDays(new Date().toISOString().slice(0, 10), -90)
  for (const [index, uid] of session.accountUids.entries()) {
    save(`account${index}.details`, await client.accountDetails(uid))
    save(`account${index}.balances`, await client.balances(uid))
    let continuationKey: string | null | undefined
    let page = 0
    do {
      const result = await client.transactions(uid, { dateFrom, continuationKey })
      page++
      save(`account${index}.transactions.page${page}`, result)
      console.log(`ok   account ${index} page ${page}: ${result.transactions.length} entries`)
      continuationKey = result.continuation_key
    } while (continuationKey && page < 100)
  }
  console.log(`raw responses in ${out} (git-ignored, personal data)`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
