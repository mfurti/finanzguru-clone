import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, normalize, relative } from 'node:path'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { unzipSync, zipSync, type Zippable } from 'fflate'
import { appVersion, latestMigration } from '../../common/app-version'
import { dataDirs } from '../../database/data-dirs'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { RESTORE_READY } from '../../database/restore'
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
    private readonly config: ConfigService,
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

  /**
   * Checks an uploaded backup and stages it for the next start (014 R2). Refuses files that
   * are not a backup of this app or come from a newer schema than this build knows.
   */
  stage(zip: Buffer): BackupManifest {
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(new Uint8Array(zip))
    } catch {
      throw new BadRequestException('Datei ist keine gültige Sicherung (kein ZIP)')
    }
    const manifest = parseManifest(files[BACKUP_MANIFEST])
    if (manifest.migration.idx > latestMigration().idx) {
      throw new BadRequestException(
        'Die Sicherung stammt von einer neueren App-Version. Bitte zuerst die App aktualisieren.',
      )
    }
    const database = files[BACKUP_DB]
    if (!database || Buffer.from(database.subarray(0, 16)).toString('latin1') !== SQLITE_HEADER) {
      throw new BadRequestException('Datei ist keine gültige Sicherung (Datenbank fehlt)')
    }
    const dir = this.dirs().restore
    rmSync(dir, { recursive: true, force: true })
    for (const [name, body] of Object.entries(files)) {
      if (name.endsWith('/')) continue
      const isLogo = name.startsWith('logos/') || name.startsWith('brand-logos/')
      if (!isLogo && name !== BACKUP_DB && name !== BACKUP_MANIFEST) continue
      const target = normalize(join(dir, name))
      // Zip entries must stay inside the staging folder.
      if (relative(dir, target).startsWith('..')) continue
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, body)
    }
    writeFileSync(join(dir, RESTORE_READY), manifest.createdAt)
    return manifest
  }

  /** Manifest of the staged restore, or null. */
  pending(): BackupManifest | null {
    const dir = this.dirs().restore
    if (!existsSync(join(dir, RESTORE_READY))) return null
    try {
      return parseManifest(readFileSync(join(dir, BACKUP_MANIFEST)))
    } catch {
      return null
    }
  }

  /** Drops a staged restore. */
  cancel(): void {
    rmSync(this.dirs().restore, { recursive: true, force: true })
  }

  private dirs() {
    return dataDirs((key) => this.config.get<string>(key))
  }
}

/** First 16 bytes of every SQLite file. */
const SQLITE_HEADER = 'SQLite format 3' + String.fromCharCode(0)

function parseManifest(raw: Uint8Array | undefined): BackupManifest {
  try {
    const value = JSON.parse(Buffer.from(raw!).toString('utf8')) as Partial<BackupManifest>
    if (
      value.app === 'vermoegenskompass' &&
      value.format === 1 &&
      typeof value.migration?.idx === 'number' &&
      typeof value.createdAt === 'string'
    ) {
      return value as BackupManifest
    }
  } catch {
    // fall through
  }
  throw new BadRequestException('Datei ist keine Sicherung dieser App')
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
