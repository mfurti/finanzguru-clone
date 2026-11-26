import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import type { BrandSearchResult, LogoRef, LogoSource, RecipientLogoInput } from '@finance/shared'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { recipientLogo } from '../../database/schema'
import { BRAND_ALIASES, CURATED_SLUGS } from '../../domain/brands'
import { logoFor, recipientKey, type LogoChoice, type LogoTx } from '../../domain/logo'
import { normalizeText } from '../../domain/dedupe'
import { brandSvg, catalogVersion, getBrand, searchBrands, type Brand } from './brand-catalog'

/** Curated aliases as extra search words per slug ("drogerie" finds dm). */
const EXTRA_WORDS = new Map(
  BRAND_ALIASES.map(({ slug, aliases }) => [slug, aliases.map((alias) => normalizeText(alias))]),
)

/** Upload limit (FR-007). */
export const MAX_LOGO_BYTES = 256 * 1024

/** Generated upload names only: uuid plus extension, so no path can be smuggled in. */
const UPLOAD_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
}

/** Image type by content (magic bytes), not by name or declared type; SVG is never accepted. */
export function imageType(file: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png'
  }
  if (file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) return 'jpg'
  if (
    file.subarray(0, 4).toString('latin1') === 'RIFF' &&
    file.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

/** Logo fields of one booking in the list (contracts/http-api.md). */
export interface BookingLogo {
  logo: LogoRef
  logoSource: LogoSource
  recipientKey: string | null
}

@Injectable()
export class LogosService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly config: ConfigService,
  ) {}

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
    const slug = input.mode === 'brand' ? (input.brandSlug ?? '') : null
    if (slug !== null && !getBrand(slug)) {
      throw new BadRequestException('Unbekannte Marke')
    }
    const previous = this.stored(key)
    const values = {
      mode: input.mode,
      brandSlug: slug,
      fileName: null,
      updatedAt: new Date().toISOString(),
    }
    this.db
      .insert(recipientLogo)
      .values({ recipientKey: key, ...values })
      .onConflictDoUpdate({ target: recipientLogo.recipientKey, set: values })
      .run()
    this.deleteFile(previous?.fileName)
    return slug ? { kind: 'brand', ...this.toResult(getBrand(slug)!) } : null
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
        contentType: CONTENT_TYPES[match[1]!]!,
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

  brandUrl(slug: string): string {
    return `/api/logos/brands/${slug}.svg?v=${catalogVersion}`
  }

  fileUrl(fileName: string): string {
    return `/api/logos/files/${fileName}`
  }

  private toResult(brand: Brand): BrandSearchResult {
    return { slug: brand.slug, title: brand.title, hex: brand.hex, url: this.brandUrl(brand.slug) }
  }

  search(q: string, limit: number): BrandSearchResult[] {
    return searchBrands(q, limit, EXTRA_WORDS, CURATED_SLUGS).map((brand) => this.toResult(brand))
  }

  /** The brand glyph as SVG, or null for an unknown slug. */
  svg(slug: string): string | null {
    const brand = getBrand(slug)
    return brand ? brandSvg(brand) : null
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
