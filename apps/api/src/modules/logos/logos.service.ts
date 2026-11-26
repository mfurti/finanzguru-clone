import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { rmSync } from 'node:fs'
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
