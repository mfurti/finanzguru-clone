import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as simpleIcons from 'simple-icons'
import { normalizeText } from '../../domain/dedupe'

/** Built-in logo sets (008 R1, R8): coloured theSVG logos first, Simple Icons glyphs as fallback. */
export type BrandSet = 'local' | 'thesvg-color' | 'simple-icons'

/** One built-in brand logo. `key` is `<set>:<name>`. */
export interface Brand {
  key: string
  set: BrandSet
  name: string
  title: string
  /** Brand colour of a single-colour glyph (6 hex digits, no "#"); null for coloured logos. */
  hex: string | null
  /** Complete standalone SVG document (built-in sets). */
  svg: string | null
  /** Raster or SVG file of a local brand (009). */
  file?: { body: Buffer; contentType: string }
}

function packageVersion(entry: string): string {
  const file = join(dirname(require.resolve(entry)), 'package.json')
  return (JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version
}

/** Package versions, part of the image URLs so browsers may cache them forever (008 R2). */
export const catalogVersions: Record<BrandSet, string> = {
  local: '0',
  'simple-icons': packageVersion('simple-icons'),
  'thesvg-color': packageVersion('@iconify-json/thesvg-color/icons.json'),
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

/**
 * Third-party SVG markup may only draw: no scripts, no event handlers, no javascript: URLs and
 * no references to other documents (008 R8). Unsafe icons are left out of the catalogue.
 */
export function isSafeSvgBody(body: string): boolean {
  return !/<script|<foreignObject|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#)/i.test(
    body,
  )
}

/** Single-colour glyph in brand colour (Simple Icons). */
export function glyphSvg(title: string, hex: string, path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><title>${escapeXml(title)}</title><path fill="#${hex}" d="${path}"/></svg>`
}

const simple = new Map<string, Brand>()
for (const icon of Object.values(simpleIcons)) {
  if (typeof icon !== 'object' || !('slug' in icon)) continue
  const hex = icon.hex.toUpperCase()
  simple.set(icon.slug, {
    key: `simple-icons:${icon.slug}`,
    set: 'simple-icons',
    name: icon.slug,
    title: icon.title,
    hex,
    svg: glyphSvg(icon.title, hex, icon.path),
  })
}

/** "deutsche-bahn" → "Deutsche Bahn"; the Simple Icons title when it has the brand ("REWE"). */
function titleFor(name: string): string {
  const known = simple.get(name.replace(/-/g, ''))
  if (known) return known.title
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

interface IconifyJson {
  width?: number
  height?: number
  icons: Record<string, { body: string; width?: number; height?: number }>
}

const colour = new Map<string, Brand>()
{
  const json = JSON.parse(
    readFileSync(require.resolve('@iconify-json/thesvg-color/icons.json'), 'utf8'),
  ) as IconifyJson
  for (const [name, icon] of Object.entries(json.icons)) {
    // "-dark" variants are white logos for dark backgrounds: invisible on the white tile.
    if (name.endsWith('-dark') || !isSafeSvgBody(icon.body)) continue
    const width = icon.width ?? json.width ?? 24
    const height = icon.height ?? json.height ?? 24
    const title = titleFor(name.replace(/-light$/, ''))
    colour.set(name, {
      key: `thesvg-color:${name}`,
      set: 'thesvg-color',
      name,
      title,
      hex: null,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><title>${escapeXml(title)}</title>${icon.body}</svg>`,
    })
  }
}

/** Local brands of the owner (009), replaced at API start. */
let local = new Map<string, Brand>()

const SETS: Record<BrandSet, () => ReadonlyMap<string, Brand>> = {
  local: () => local,
  'thesvg-color': () => colour,
  'simple-icons': () => simple,
}

/**
 * Registers the owner's local logos (009 R1); they win over built-in brands in search and
 * matching. `version` changes the image URLs so browsers fetch replaced files.
 */
export function setLocalBrands(
  brands: readonly { key: string; title: string; body: Buffer; contentType: string }[],
  version: string,
): void {
  local = new Map(
    brands.map((brand) => [
      brand.key,
      {
        key: `local:${brand.key}`,
        set: 'local' as const,
        name: brand.key,
        title: brand.title,
        hex: null,
        svg: null,
        file: { body: brand.body, contentType: brand.contentType },
      },
    ]),
  )
  catalogVersions.local = version
  for (const brand of local.values())
    SEARCH_TEXT.set(brand.key, normalizeText(`${brand.title} ${brand.name}`))
}

/** Brand by key `<set>:<name>`; a key without set is a Simple Icons slug (stored before R8). */
export function getBrand(key: string): Brand | undefined {
  const [set, name] = key.includes(':') ? key.split(':', 2) : ['simple-icons', key]
  return SETS[set as BrandSet]?.().get(name!)
}

/** Local first, then coloured, then glyphs (009 R3). */
const SET_ORDER: Record<BrandSet, number> = { local: 0, 'thesvg-color': 1, 'simple-icons': 2 }

/** Search text per key: title and name, normalized like recipient names. */
const ALL: readonly Brand[] = [...colour.values(), ...simple.values()]
const SEARCH_TEXT = new Map(ALL.map((b) => [b.key, normalizeText(`${b.title} ${b.name}`)]))

/**
 * Brands whose title, name or extra words (curated aliases, by key) contain `query`.
 * `preferred` keys come first; with an empty query only those are returned. A brand that
 * exists in both sets is listed once, the coloured one first.
 */
export function searchBrands(
  query: string,
  limit: number,
  extraWords: ReadonlyMap<string, readonly string[]> = new Map(),
  preferred: readonly string[] = [],
): Brand[] {
  const text = normalizeText(query)
  const matches = (brand: Brand) =>
    !text ||
    (SEARCH_TEXT.get(brand.key) ?? '').includes(text) ||
    (extraWords.get(brand.key) ?? []).some((word) => word.includes(text))
  const first = preferred
    .map((key) => getBrand(key))
    .filter((brand): brand is Brand => !!brand && matches(brand))
  const rest = text
    ? [...local.values(), ...ALL]
        .filter((brand) => matches(brand))
        .sort((a, b) => a.title.localeCompare(b.title, 'de') || SET_ORDER[a.set] - SET_ORDER[b.set])
    : []
  const seen = new Set<string>()
  const out: Brand[] = []
  for (const brand of [...first, ...rest]) {
    const id = normalizeText(brand.title)
    if (seen.has(brand.key) || seen.has(id)) continue
    seen.add(brand.key)
    seen.add(id)
    out.push(brand)
    if (out.length === limit) break
  }
  return out
}
