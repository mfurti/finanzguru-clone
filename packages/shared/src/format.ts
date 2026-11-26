/** de-DE display formatting shared by the web app and API exports (FR-004). */

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const eurSigned = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

const eurCompact = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const pct = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pctSigned = new Intl.NumberFormat('de-DE', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

const dateFmt = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' })

/** Intl uses U+00A0 / U+202F between number and symbol; keep a normal space for copy/paste. */
const normalizeSpaces = (value: string) => value.replace(/[\u00A0\u202F]/g, ' ')

/** `185645` → `1.856,45 €` */
export function formatEur(cents: number): string {
  return normalizeSpaces(eur.format(cents / 100))
}

/** `14740` → `+147,40 €`, `-13423` → `-134,23 €`, `0` → `0,00 €` */
export function formatEurSigned(cents: number): string {
  return normalizeSpaces(eurSigned.format(cents / 100))
}

/** Compact axis labels in de-DE notation (e.g. `5000 €`, `1,2 Mio. €`). */
export function formatEurCompact(cents: number): string {
  return normalizeSpaces(eurCompact.format(cents / 100))
}

/** Ratio to percent: `0.0815` → `8,15 %` */
export function formatPct(ratio: number): string {
  return normalizeSpaces(pct.format(ratio))
}

/** Ratio to signed percent: `0.0815` → `+8,15 %` */
export function formatPctSigned(ratio: number): string {
  return normalizeSpaces(pctSigned.format(ratio))
}

/** `2026-06-12` → `12.06.2026` */
export function formatDate(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T00:00:00Z`))
}

/** `2026-11-01` → `Nov` */
export function formatMonthShort(isoDate: string): string {
  return monthFmt.format(new Date(`${isoDate}T00:00:00Z`)).replace('.', '')
}

/** Sign class for gains/losses: green for > 0, red for < 0, neutral otherwise. */
export function signTone(value: number): 'positive' | 'negative' | 'neutral' {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}
