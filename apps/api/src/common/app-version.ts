import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MIGRATIONS_FOLDER } from '../database/migrate'

/** App version: APP_VERSION (set by the release image), else the API package version. */
export function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
      version?: string
    }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** Newest migration this build knows (index and tag from the drizzle journal). */
export function latestMigration(folder = MIGRATIONS_FOLDER): { idx: number; tag: string } {
  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf8')) as {
    entries: { idx: number; tag: string }[]
  }
  const last = journal.entries.at(-1)
  if (!last) throw new Error('Migration journal is empty')
  return { idx: last.idx, tag: last.tag }
}
