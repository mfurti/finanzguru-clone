import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as simpleIcons from 'simple-icons'
import { normalizeText } from '../../domain/dedupe'

/** One built-in brand logo (Simple Icons, CC0): single-colour 24×24 glyph and brand colour. */
export interface Brand {
  slug: string
  title: string
  /** Brand colour, 6 hex digits without "#". */
  hex: string
  /** SVG path data of the 24×24 glyph. */
  path: string
}

/** Package version, part of the image URLs so browsers can cache them forever (008 R2). */
export const catalogVersion: string = (
  JSON.parse(
    readFileSync(join(dirname(require.resolve('simple-icons')), 'package.json'), 'utf8'),
  ) as { version: string }
).version

/** All brands by slug, loaded once (≈ 3 400 entries, a few MB in memory). */
const BRANDS: ReadonlyMap<string, Brand> = new Map(
  Object.values(simpleIcons)
    .filter((icon): icon is simpleIcons.SimpleIcon => typeof icon === 'object' && 'slug' in icon)
    .map((icon) => [
      icon.slug,
      { slug: icon.slug, title: icon.title, hex: icon.hex.toUpperCase(), path: icon.path },
    ]),
)

/** Search text per slug: title and slug, normalized like recipient names. */
const SEARCH_TEXT = new Map(
  [...BRANDS.values()].map((b) => [b.slug, normalizeText(`${b.title} ${b.slug}`)]),
)

export function getBrand(slug: string): Brand | undefined {
  return BRANDS.get(slug)
}

/**
 * Brands whose title, slug or extra words (curated aliases) contain `query`. `preferred` slugs
 * come first; with an empty query only the preferred brands are returned.
 */
export function searchBrands(
  query: string,
  limit: number,
  extraWords: ReadonlyMap<string, readonly string[]> = new Map(),
  preferred: readonly string[] = [],
): Brand[] {
  const text = normalizeText(query)
  const matches = (slug: string) =>
    !text ||
    (SEARCH_TEXT.get(slug) ?? '').includes(text) ||
    (extraWords.get(slug) ?? []).some((word) => word.includes(text))
  const first = preferred.filter((slug) => BRANDS.has(slug) && matches(slug))
  const rest = text
    ? [...BRANDS.keys()]
        .filter((slug) => !first.includes(slug) && matches(slug))
        .sort((a, b) => BRANDS.get(a)!.title.localeCompare(BRANDS.get(b)!.title, 'de'))
    : []
  return [...first, ...rest].slice(0, limit).map((slug) => BRANDS.get(slug)!)
}

/** The glyph as a standalone SVG in brand colour (served as an image, cannot run scripts). */
export function brandSvg(brand: Brand): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><title>${escapeXml(brand.title)}</title><path fill="#${brand.hex}" d="${brand.path}"/></svg>`
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
