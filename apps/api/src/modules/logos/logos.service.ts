import { Inject, Injectable } from '@nestjs/common'
import type { BrandSearchResult, LogoRef, LogoSource } from '@finance/shared'
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
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

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
