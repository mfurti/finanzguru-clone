import type { InsuranceType, PremiumInterval } from '@finance/shared'

/** An outgoing booking in a Versicherung category (amount negative, cents). */
export interface InsuranceBooking {
  date: string
  amountCents: number
  counterparty: string | null
  /** Name of the (sub) category, used to guess the insurance type. */
  categoryName: string | null
}

export interface InsuranceSuggestion {
  key: string
  counterparty: string
  amountCents: number
  interval: PremiumInterval
  type: InsuranceType
  count: number
  firstDate: string
  lastDate: string
}

/** Gap in days per interval with the tolerance accepted around it. */
const INTERVALS: [PremiumInterval, number, number][] = [
  ['monthly', 23, 38],
  ['quarterly', 80, 100],
  ['semiannual', 170, 195],
  ['annual', 350, 380],
]

const TYPES: [RegExp, InsuranceType][] = [
  [/kranken/i, 'health'],
  [/risiko|lebensvers/i, 'term_life'],
  [/haftpflicht/i, 'liability'],
  [/hausrat|wohngeb/i, 'household'],
  [/berufsunf/i, 'disability'],
  [/kfz|auto/i, 'car'],
  [/rechtsschutz/i, 'legal'],
]

/** Lower case, letters and digits only: "R+V Lebensversicherung AG" → "rvlebensversicherungag". */
export function normalizeCounterparty(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/g, '')
    .slice(0, 150)
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * Recurring insurance payments (012 P14): bookings of the same counterparty, at least two,
 * all gaps within one interval band and every amount within ±10 % of the last one, become a
 * suggestion. Counterparties that already have a contract or were dismissed are skipped.
 */
export function detectInsuranceSuggestions(
  bookings: readonly InsuranceBooking[],
  existingProviders: readonly string[],
  dismissed: ReadonlySet<string>,
): InsuranceSuggestion[] {
  const known = existingProviders.map(normalizeCounterparty).filter(Boolean)
  const groups = new Map<string, InsuranceBooking[]>()
  for (const booking of bookings) {
    if (!booking.counterparty || booking.amountCents >= 0) continue
    const name = normalizeCounterparty(booking.counterparty)
    if (!name) continue
    groups.set(name, [...(groups.get(name) ?? []), booking])
  }

  const result: InsuranceSuggestion[] = []
  for (const [name, list] of groups) {
    if (list.length < 2) continue
    if (known.some((provider) => provider.includes(name) || name.includes(provider))) continue
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const gaps = sorted.slice(1).map((booking, i) => days(sorted[i]!.date, booking.date))
    const interval = INTERVALS.find(([, min, max]) => gaps.every((gap) => gap >= min && gap <= max))
    if (!interval) continue
    const last = sorted.at(-1)!
    const amount = Math.abs(last.amountCents)
    if (sorted.some((booking) => Math.abs(Math.abs(booking.amountCents) - amount) > amount * 0.1))
      continue
    const key = `${name}:${interval[0]}`
    if (dismissed.has(key)) continue
    const category = sorted.map((booking) => booking.categoryName ?? '').join(' ')
    result.push({
      key,
      counterparty: last.counterparty!,
      amountCents: amount,
      interval: interval[0],
      type: TYPES.find(([pattern]) => pattern.test(category))?.[1] ?? 'other',
      count: sorted.length,
      firstDate: sorted[0]!.date,
      lastDate: last.date,
    })
  }
  return result.sort((a, b) => b.amountCents - a.amountCents)
}
