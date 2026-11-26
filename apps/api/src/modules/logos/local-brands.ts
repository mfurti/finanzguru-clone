import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { isSafeSvgBody } from './brand-catalog'
import { CONTENT_TYPES, imageType, MAX_LOGO_BYTES } from './image-type'

/**
 * Logos the owner keeps in a local, git-ignored folder (009 R1, R2): official bank, broker or
 * merchant logos without a free licence. Read once at API start; nothing here is required.
 */
export interface LocalBrand {
  key: string
  title: string
  words: string[]
  body: Buffer
  contentType: string
}

const entry = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,60}$/),
  title: z.string().trim().min(1).max(60),
  words: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  file: z.string().regex(/^[\w.-]{1,80}$/),
})

/** SVG content without a leading XML declaration or doctype, checked like set logos. */
function safeSvg(body: Buffer): boolean {
  const text = body.toString('utf8').trimStart()
  if (!/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return false
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return false
  return isSafeSvgBody(text)
}

/**
 * Reads `brands.json` and its files from `dir`. Invalid entries are skipped and reported via
 * `warn` (one message each); a missing folder or file list gives an empty set.
 */
export function loadLocalBrands(dir: string, warn: (message: string) => void): LocalBrand[] {
  const listPath = join(dir, 'brands.json')
  if (!existsSync(listPath)) return []
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(listPath, 'utf8'))
  } catch {
    warn(`Lokale Logos: brands.json ist kein gültiges JSON`)
    return []
  }
  if (!Array.isArray(raw)) {
    warn(`Lokale Logos: brands.json muss eine Liste sein`)
    return []
  }
  const brands: LocalBrand[] = []
  const keys = new Set<string>()
  raw.forEach((item: unknown, index) => {
    const parsed = entry.safeParse(item)
    if (!parsed.success) {
      warn(`Lokale Logos: Eintrag ${index + 1} ungültig (key, title, words, file prüfen)`)
      return
    }
    const { key, title, words, file } = parsed.data
    if (keys.has(key)) {
      warn(`Lokale Logos: "${key}" doppelt, zweiter Eintrag ignoriert`)
      return
    }
    const path = join(dir, file)
    if (!existsSync(path) || !statSync(path).isFile()) {
      warn(`Lokale Logos: Datei ${file} fehlt`)
      return
    }
    if (statSync(path).size > MAX_LOGO_BYTES) {
      warn(`Lokale Logos: ${file} ist größer als 256 KB`)
      return
    }
    const body = readFileSync(path)
    const raster = imageType(body)
    let contentType: string
    if (raster) contentType = CONTENT_TYPES[raster]
    else if (file.toLowerCase().endsWith('.svg') && safeSvg(body)) {
      contentType = 'image/svg+xml; charset=utf-8'
    } else {
      warn(`Lokale Logos: ${file} ist kein PNG, JPEG, WebP oder sicheres SVG`)
      return
    }
    keys.add(key)
    brands.push({ key, title, words, body, contentType })
  })
  return brands
}
