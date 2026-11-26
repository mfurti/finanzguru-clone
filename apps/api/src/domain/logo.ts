import type { TransactionType } from '@finance/shared'
import { BRAND_ALIASES } from './brands'
import { counterpartyKey } from './categorize'
import { normalizeText } from './dedupe'

/** Bookings that come from a merchant; transfers and trades keep their icons (008 R6). */
const WITH_LOGO = new Set<TransactionType>([
  'income',
  'expense',
  'fee',
  'interest',
  'tax',
  'deposit',
  'withdrawal',
])

const MAX_KEY = 200
const PURPOSE_PART = 40

export interface LogoTx {
  type: TransactionType
  counterparty?: string | null
  counterpartyIban?: string | null
  purpose?: string | null
}

/** Stored logo choice of one recipient (table recipient_logo). */
export interface LogoChoice {
  mode: 'brand' | 'none' | 'upload'
  brandSlug: string | null
  fileName: string | null
}

/** Result before URLs are added: which brand or file, and whether it was chosen. */
export type LogoDecision =
  | { kind: 'brand'; slug: string; source: 'auto' | 'manual' }
  | { kind: 'upload'; fileName: string; source: 'manual' }
  | null

/** Purpose text after the posting text ("KARTENZAHLUNG · LIDL …" → "lidl …"), normalized. */
function purposePart(purpose: string | null | undefined): string {
  const parts = (purpose ?? '').split(' · ')
  return normalizeText(parts.length > 1 ? parts.slice(1).join(' ') : parts[0])
}

/**
 * Key a logo choice is stored under (008 R5), same fallback order as the 006 rule draft:
 * counterparty, else `iban:<IBAN>`, else `purpose:<first 40 characters of the purpose part>`.
 */
export function recipientKey(tx: Omit<LogoTx, 'type'>): string | null {
  const key = counterpartyKey(tx)
  if (key) return key
  const iban = (tx.counterpartyIban ?? '').replace(/\s+/g, '').toUpperCase()
  if (iban) return `iban:${iban}`.slice(0, MAX_KEY)
  const part = purposePart(tx.purpose).slice(0, PURPOSE_PART).trim()
  return part ? `purpose:${part}` : null
}

/** Words of a text: letters and digits only, so "PayPal (Europe)" → ["paypal", "europe"]. */
function words(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

interface Alias {
  keys: readonly string[]
  words: string[]
  local: boolean
}

const BUILT_IN: Alias[] = BRAND_ALIASES.flatMap(({ keys, aliases }) =>
  aliases.map((alias) => ({ keys, words: words(alias), local: false })),
)

/** Aliases as word lists, longest first ("aldi sud" before "aldi"), local before built-in. */
let ALIASES: Alias[] = sortAliases(BUILT_IN)

function sortAliases(list: Alias[]): Alias[] {
  return [...list].sort(
    (a, b) => b.words.length - a.words.length || Number(b.local) - Number(a.local),
  )
}

/** The owner's local logos (009 R3): their words match ahead of built-in aliases. */
export function setLocalAliases(
  entries: readonly { key: string; words: readonly string[] }[],
): void {
  const local = entries.flatMap(({ key, words: list }) =>
    list.map((alias) => ({ keys: [key], words: words(alias), local: true })),
  )
  ALIASES = sortAliases([...local, ...BUILT_IN].filter((alias) => alias.words.length > 0))
}

function containsWords(haystack: readonly string[], needle: readonly string[]): boolean {
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return true
  }
  return false
}

/**
 * Brand keys (in order of preference) whose alias appears as whole consecutive words in
 * `text`, or null.
 */
export function matchBrand(text: string | null | undefined): readonly string[] | null {
  const tokens = words(text ?? '')
  if (tokens.length === 0) return null
  return ALIASES.find((alias) => containsWords(tokens, alias.words))?.keys ?? null
}

/**
 * Logo of a booking (FR-004): own upload, else chosen brand, else nothing for "Kein Logo",
 * else the automatic match on counterparty (or purpose part), else null (initials).
 * `brandExists` guards against keys that left the catalogue in a later version; the first
 * existing key of a match wins (coloured logo before glyph, 008 R8).
 */
export function logoFor(
  tx: LogoTx,
  choice: LogoChoice | undefined,
  brandExists: (slug: string) => boolean,
): LogoDecision {
  if (!WITH_LOGO.has(tx.type)) return null
  if (choice?.mode === 'upload' && choice.fileName) {
    return { kind: 'upload', fileName: choice.fileName, source: 'manual' }
  }
  if (choice?.mode === 'brand' && choice.brandSlug && brandExists(choice.brandSlug)) {
    return { kind: 'brand', slug: choice.brandSlug, source: 'manual' }
  }
  if (choice?.mode === 'none') return null
  const keys =
    matchBrand(tx.counterparty) ?? (tx.counterparty ? null : matchBrand(purposePart(tx.purpose)))
  const slug = keys?.find((key) => brandExists(key))
  return slug ? { kind: 'brand', slug, source: 'auto' } : null
}
