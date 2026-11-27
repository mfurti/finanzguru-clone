import { dirname, resolve } from 'node:path'

/** Reads one setting (ConfigService.get or process.env). */
export type ReadSetting = (key: string) => string | undefined

/**
 * Folders next to the database (data folder): uploaded logos, the owner's local logos and the
 * staged restore (014). Each can be moved by its env variable.
 */
export function dataDirs(read: ReadSetting): {
  database: string
  logos: string
  brandLogos: string
  restore: string
} {
  const database = read('DATABASE_PATH') ?? './data/app.db'
  const base = dirname(database)
  const pick = (key: string, fallback: string) => resolve(read(key) || resolve(base, fallback))
  return {
    database,
    logos: pick('LOGOS_DIR', 'logos'),
    brandLogos: pick('BRAND_LOGOS_DIR', 'brand-logos'),
    restore: pick('RESTORE_DIR', 'restore'),
  }
}
