import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { Inject, Injectable } from '@nestjs/common'
import { zipSync, type Zippable } from 'fflate'
import { appVersion, latestMigration } from '../../common/app-version'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { LogosService } from '../logos/logos.service'

/** Name of the database file and the manifest inside a backup zip. */
export const BACKUP_DB = 'app.sqlite'
export const BACKUP_MANIFEST = 'manifest.json'

/** `manifest.json` of a backup (014 R2). */
export interface BackupManifest {
  app: 'vermoegenskompass'
  format: 1
  appVersion: string
  migration: { idx: number; tag: string }
  createdAt: string
}

/**
 * Backup (014 US1): a zip with a consistent SQLite snapshot (`VACUUM INTO`, safe while the
 * app runs), the uploaded and local logo folders and a manifest. Nothing leaves the server;
 * the owner downloads the file.
 */
@Injectable()
export class BackupService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly logos: LogosService,
  ) {}

  manifest(now = new Date()): BackupManifest {
    return {
      app: 'vermoegenskompass',
      format: 1,
      appVersion: appVersion(),
      migration: latestMigration(),
      createdAt: now.toISOString(),
    }
  }

  create(now = new Date()): { fileName: string; body: Buffer } {
    const dir = mkdtempSync(join(tmpdir(), 'backup-'))
    try {
      const snapshot = join(dir, BACKUP_DB)
      this.db.$client.exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`)
      const files: Zippable = {
        [BACKUP_MANIFEST]: Buffer.from(JSON.stringify(this.manifest(now), null, 2)),
        [BACKUP_DB]: readFileSync(snapshot),
      }
      addFolder(files, this.logos.logosDir(), 'logos')
      addFolder(files, this.logos.brandLogosDir(), 'brand-logos')
      const stamp = now.toISOString().slice(0, 10)
      return {
        fileName: `vermoegenskompass-backup-${stamp}.zip`,
        body: Buffer.from(zipSync(files, { level: 6 })),
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

/** Adds every file below `dir` as `<prefix>/<relative path>` (missing folder: nothing). */
function addFolder(files: Zippable, dir: string, prefix: string): void {
  if (!existsSync(dir)) return
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name)
      if (statSync(path).isDirectory()) walk(path)
      else files[`${prefix}/${relative(dir, path).replaceAll('\\', '/')}`] = readFileSync(path)
    }
  }
  walk(dir)
}
