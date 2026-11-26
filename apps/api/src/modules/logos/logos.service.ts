import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import type { BrandSearchResult, LogoRef, LogoSource, RecipientLogoInput } from '@finance/shared'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { recipientLogo } from '../../database/schema'
import { BRAND_ALIASES } from '../../domain/brands'
import {
  logoFor,
  recipientKey,
  setLocalAliases,
  type LogoChoice,
  type LogoTx,
} from '../../domain/logo'
import { normalizeText } from '../../domain/dedupe'
import {
  catalogVersions,
  getBrand,
  searchBrands,
  setLocalBrands,
  type Brand,
} from './brand-catalog'
import { CONTENT_TYPES, imageType, type RasterType } from './image-type'
import { loadLocalBrands } from './local-brands'

/** Curated brands: the key shown (first in the catalogue) and its aliases as search words. */
const CURATED = BRAND_ALIASES.flatMap(({ keys, aliases }) => {
  const key = keys.find((candidate) => getBrand(candidate))
  return key ? [{ key, words: aliases.map((alias) => normalizeText(alias)) }] : []
})
/** Extra search words per key ("drogerie" finds dm). */
const EXTRA_WORDS = new Map(CURATED.map(({ key, words }) => [key, words]))
/** Shown first in the picker, in curated order. */
const CURATED_KEYS = CURATED.map(({ key }) => key)

/** Generated upload names only: uuid plus extension, so no path can be smuggled in. */
const UPLOAD_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/

/** Logo fields of one booking in the list (contracts/http-api.md). */
export interface BookingLogo {
  logo: LogoRef
  logoSource: LogoSource
  recipientKey: string | null
}

@Injectable()
export class LogosService {
  private readonly logger = new Logger(LogosService.name)
  /** Local brands' match words by key, for the picker search (009). */
  private localWords = new Map<string, string[]>()
  private localKeys: string[] = []

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly config: ConfigService,
  ) {
    this.loadLocal()
  }

  /** Folder of the owner's local logos: BRAND_LOGOS_DIR, else `brand-logos/` next to the DB. */
  brandLogosDir(): string {
    const configured = this.config.get<string>('BRAND_LOGOS_DIR')
    if (configured) return resolve(configured)
    return resolve(dirname(this.config.getOrThrow<string>('DATABASE_PATH')), 'brand-logos')
  }

  /** Reads the local logo folder (009 R2); invalid entries are skipped with a warning. */
  loadLocal(): void {
    const brands = loadLocalBrands(this.brandLogosDir(), (message) => this.logger.warn(message))
    const version = createHash('sha256')
      .update(brands.map((brand) => `${brand.key}:${brand.body.length}`).join('|'))
      .update(Buffer.concat(brands.map((brand) => brand.body)))
      .digest('hex')
      .slice(0, 12)
    setLocalBrands(brands, version)
    setLocalAliases(brands.map((brand) => ({ key: `local:${brand.key}`, words: brand.words })))
    this.localKeys = brands.map((brand) => `local:${brand.key}`)
    this.localWords = new Map(
      brands.map((brand) => [`local:${brand.key}`, brand.words.map((word) => normalizeText(word))]),
    )
    if (brands.length > 0) this.logger.log(`Lokale Logos geladen: ${brands.length}`)
  }

  /** A local logo file by its key, or null. */
  localFile(key: string): { body: Buffer; contentType: string } | null {
    return getBrand(`local:${key}`)?.file ?? null
  }

  /** Folder of uploaded logos: LOGOS_DIR, else `logos/` next to the database (git-ignored data). */
  logosDir(): string {
    const configured = this.config.get<string>('LOGOS_DIR')
    if (configured) return resolve(configured)
    return resolve(dirname(this.config.getOrThrow<string>('DATABASE_PATH')), 'logos')
  }

  private deleteFile(fileName: string | null | undefined): void {
    if (fileName) rmSync(join(this.logosDir(), fileName), { force: true })
  }

  private stored(key: string) {
    return this.db.select().from(recipientLogo).where(eq(recipientLogo.recipientKey, key)).get()
  }

  /** Saves a brand or "Kein Logo" for a recipient (US2); replaces an upload. */
  setChoice(key: string, input: RecipientLogoInput): LogoRef {
    const brand = input.mode === 'brand' ? getBrand(input.brandSlug ?? '') : null
    if (brand === undefined) {
      throw new BadRequestException('Unbekannte Marke')
    }
    const previous = this.stored(key)
    const values = {
      mode: input.mode,
      brandSlug: brand?.key ?? null,
      fileName: null,
      updatedAt: new Date().toISOString(),
    }
    this.db
      .insert(recipientLogo)
      .values({ recipientKey: key, ...values })
      .onConflictDoUpdate({ target: recipientLogo.recipientKey, set: values })
      .run()
    this.deleteFile(previous?.fileName)
    return brand ? { kind: 'brand', ...this.toResult(brand) } : null
  }

  /** Stores an own logo for a recipient (US3); replaces a previous upload. */
  saveUpload(key: string, file: Buffer): LogoRef {
    const ext = imageType(file)
    if (!ext) throw new UnsupportedMediaTypeException('Nur PNG, JPEG oder WebP')
    const fileName = `${randomUUID()}.${ext}`
    mkdirSync(this.logosDir(), { recursive: true })
    writeFileSync(join(this.logosDir(), fileName), file)
    const previous = this.stored(key)
    const values = {
      mode: 'upload' as const,
      brandSlug: null,
      fileName,
      updatedAt: new Date().toISOString(),
    }
    this.db
      .insert(recipientLogo)
      .values({ recipientKey: key, ...values })
      .onConflictDoUpdate({ target: recipientLogo.recipientKey, set: values })
      .run()
    this.deleteFile(previous?.fileName)
    return { kind: 'upload', url: this.fileUrl(fileName) }
  }

  /** An uploaded file by its generated name (no other names are accepted). */
  readUpload(name: string): { body: Buffer; contentType: string } {
    const match = UPLOAD_NAME.exec(name)
    if (!match) throw new NotFoundException('Logo nicht gefunden')
    try {
      return {
        body: readFileSync(join(this.logosDir(), name)),
        contentType: CONTENT_TYPES[match[1] as RasterType],
      }
    } catch {
      throw new NotFoundException('Logo nicht gefunden')
    }
  }

  /** Back to "Automatisch": removes the choice and an uploaded file. */
  removeChoice(key: string): void {
    const previous = this.stored(key)
    this.db.delete(recipientLogo).where(eq(recipientLogo.recipientKey, key)).run()
    this.deleteFile(previous?.fileName)
  }

  /** All stored choices by recipient key (a few hundred rows at most), one query per list. */
  choices(): Map<string, LogoChoice> {
    return new Map(
      this.db
        .select()
        .from(recipientLogo)
        .all()
        .map((row) => [
          row.recipientKey,
          { mode: row.mode, brandSlug: row.brandSlug, fileName: row.fileName },
        ]),
    )
  }

  brandUrl(brand: Brand): string {
    if (brand.set === 'local') {
      return `/api/logos/brands/local/${brand.name}?v=${catalogVersions.local}`
    }
    return `/api/logos/brands/${brand.set}/${brand.name}.svg?v=${catalogVersions[brand.set]}`
  }

  fileUrl(fileName: string): string {
    return `/api/logos/files/${fileName}`
  }

  private toResult(brand: Brand): BrandSearchResult {
    return { slug: brand.key, title: brand.title, hex: brand.hex, url: this.brandUrl(brand) }
  }

  search(q: string, limit: number): BrandSearchResult[] {
    const words = new Map([...EXTRA_WORDS, ...this.localWords])
    return searchBrands(q, limit, words, [...this.localKeys, ...CURATED_KEYS]).map((brand) =>
      this.toResult(brand),
    )
  }

  /** The brand logo as SVG, or null for an unknown set or name. */
  svg(set: string, name: string): string | null {
    if (set === 'local') return null
    return getBrand(`${set}:${name}`)?.svg ?? null
  }

  /**
   * Logo fields for a booking (FR-004). `choices` holds the stored choice per recipient key,
   * loaded once per request.
   */
  forBooking(tx: LogoTx, choices: ReadonlyMap<string, LogoChoice>): BookingLogo {
    const key = recipientKey(tx)
    const decision = logoFor(tx, key ? choices.get(key) : undefined, (slug) => !!getBrand(slug))
    if (!decision) return { logo: null, logoSource: null, recipientKey: key }
    if (decision.kind === 'upload') {
      return {
        logo: { kind: 'upload', url: this.fileUrl(decision.fileName) },
        logoSource: 'manual',
        recipientKey: key,
      }
    }
    const brand = getBrand(decision.slug)!
    return {
      logo: { kind: 'brand', ...this.toResult(brand) },
      logoSource: decision.source,
      recipientKey: key,
    }
  }
}
