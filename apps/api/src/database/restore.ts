import { cpSync, existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { dataDirs } from './data-dirs'

/** Marker written last when a restore is fully staged (014 R2). */
export const RESTORE_READY = 'READY'

/**
 * Applies a staged restore before the database is opened (and before migrations run).
 * The current database and logo folders are kept next to them as `*.before-restore-<time>`,
 * so a wrong restore can be undone by hand. Returns true when a restore was applied.
 */
export function applyStagedRestore(
  dirs: ReturnType<typeof dataDirs>,
  log: (message: string) => void = () => undefined,
  now = new Date(),
): boolean {
  if (dirs.database === ':memory:') return false
  const ready = join(dirs.restore, RESTORE_READY)
  if (!existsSync(ready)) return false
  const stamp = now.toISOString().replaceAll(':', '-').slice(0, 19)
  const keep = (path: string) => {
    if (existsSync(path)) renameSync(path, `${path}.before-restore-${stamp}`)
  }

  keep(dirs.database)
  for (const suffix of ['-wal', '-shm']) rmSync(dirs.database + suffix, { force: true })
  cpSync(join(dirs.restore, 'app.sqlite'), dirs.database)
  for (const [folder, target] of [
    ['logos', dirs.logos],
    ['brand-logos', dirs.brandLogos],
  ] as const) {
    const staged = join(dirs.restore, folder)
    if (!existsSync(staged)) continue
    keep(target)
    cpSync(staged, target, { recursive: true })
  }
  const manifest = readFileSync(join(dirs.restore, 'manifest.json'), 'utf8')
  rmSync(dirs.restore, { recursive: true, force: true })
  log(`Wiederherstellung angewendet (${JSON.parse(manifest).createdAt as string})`)
  return true
}
