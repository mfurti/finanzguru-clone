/**
 * Sparkline series for the accounts list (003 US2): the last `days` daily
 * values. Fewer than two points become a flat line so the UI never has to
 * guess (edge case in spec.md).
 */
export function sparkline(values: readonly number[], days = 30): number[] {
  const tail = values.slice(-days)
  if (tail.length >= 2) return tail
  const only = tail[0] ?? 0
  return [only, only]
}

/** "DE12 •••• •••• 3456": country + check digits, last 4 characters (FR-008). */
export function maskIban(iban: string | null | undefined): string | null {
  if (!iban) return null
  const compact = iban.replace(/\s+/g, '').toUpperCase()
  if (compact.length < 8) return compact
  return `${compact.slice(0, 4)} •••• •••• ${compact.slice(-4)}`
}

/** Up to two initials for institution/account avatars. */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[1]![0]!
  return letters.toUpperCase()
}
