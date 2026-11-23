/**
 * CLI: set the owner's display name and password.
 *   pnpm --filter api owner:set-password [-- --name "Alex"]
 *   docker exec -it finance-api node dist/scripts/set-password.js --name "Alex"
 * The password is read without echo from the terminal, or from OWNER_PASSWORD
 * for non-interactive use (never pass it as an argument: it would land in shell history).
 */
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { runMigrations } from '../database/migrate'
import { openDatabase } from '../database/open-database'
import { owner } from '../database/schema'
import { hashPassword } from '../modules/auth/password'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function promptHidden(question: string): Promise<string> {
  let muted = false
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk)
      callback()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: true })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

async function main(): Promise<void> {
  const path = process.env.DATABASE_PATH ?? './data/app.db'
  const sqlite = openDatabase(path)
  const db = drizzle({ client: sqlite })
  runMigrations(db)

  const existing = db.select().from(owner).where(eq(owner.id, 'owner')).get()
  const displayName = argValue('--name') ?? existing?.displayName ?? 'Owner'
  if (displayName.length < 1 || displayName.length > 60) {
    throw new Error('--name must be 1–60 characters')
  }

  let password = process.env.OWNER_PASSWORD
  if (!password) {
    password = await promptHidden('Neues Passwort: ')
    const repeat = await promptHidden('Passwort wiederholen: ')
    if (password !== repeat) throw new Error('Passwörter stimmen nicht überein')
  }
  if (password.length < 12) throw new Error('Passwort muss mindestens 12 Zeichen haben')

  const passwordHash = await hashPassword(password)
  db.insert(owner)
    .values({ id: 'owner', displayName, passwordHash })
    .onConflictDoUpdate({ target: owner.id, set: { displayName, passwordHash } })
    .run()
  sqlite.close()
  console.log(`Owner "${displayName}" gespeichert in ${path}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
