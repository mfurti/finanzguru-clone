/**
 * Cross-source match for live bank bookings (005 research R2).
 *
 * CSV exports and the PSD2 interface describe the same booking with different texts, so the
 * fingerprint alone would import it twice. A live booking is linked to an existing row of the same
 * account when date (±1 day) and amount agree; ties are broken by counterparty, then exact date.
 * Still ambiguous → no match, and the booking is imported (left "ungeprüft" for the owner).
 */
import { daysBetween } from './period'
import { normalizeText } from './dedupe'

export interface MatchItem {
  bookingDate: string
  amountCents: number
  counterparty?: string | null
}

export interface MatchCandidate extends MatchItem {
  id: string
}

/** Largest date difference between the CSV and the live booking, in days. */
export const MATCH_WINDOW_DAYS = 1

/** Id of the one existing row this booking stands for, or undefined. */
export function findBankMatch(
  item: MatchItem,
  candidates: readonly MatchCandidate[],
): string | undefined {
  let pool = candidates.filter(
    (row) =>
      row.amountCents === item.amountCents &&
      Math.abs(daysBetween(row.bookingDate, item.bookingDate)) <= MATCH_WINDOW_DAYS,
  )
  if (pool.length <= 1) return pool[0]?.id
  const party = normalizeText(item.counterparty)
  if (party) {
    const same = pool.filter((row) => sameParty(normalizeText(row.counterparty), party))
    if (same.length > 0) pool = same
  }
  if (pool.length > 1) {
    const sameDay = pool.filter((row) => row.bookingDate === item.bookingDate)
    if (sameDay.length > 0) pool = sameDay
  }
  return pool.length === 1 ? pool[0]!.id : undefined
}

/** Names match when one contains the other ("REWE" vs. "REWE Markt GmbH"). */
function sameParty(a: string, b: string): boolean {
  return !!a && (a.includes(b) || b.includes(a))
}
