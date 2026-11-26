/**
 * Visible columns of the Transaktionen table like the reference (012 P1): the chooser offers
 * Datum, Kategorie, Tags, Eigenschaften, Betrag and Steuern; Datum, Kategorie, Eigenschaften
 * and Betrag are on by default. Konto and Verwendungszweck are no table columns any more
 * (they stay in the booking side panel); stored flags for them are dropped.
 */
export const BOOKING_COLUMN_DEFAULTS: Readonly<Record<string, boolean>> = {
  date: true,
  category: true,
  tags: false,
  properties: true,
  amount: true,
  taxes: false,
}
const DROPPED = new Set(['account', 'purpose'])

/** Merges a stored choice (may be partial or broken JSON) over the defaults. */
export function initialColumnVisibility(stored: string | null): Record<string, boolean> {
  try {
    const parsed = JSON.parse(stored ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const kept = Object.entries(parsed as Record<string, unknown>).filter(
        ([key, value]) =>
          !DROPPED.has(key) && key in BOOKING_COLUMN_DEFAULTS && typeof value === 'boolean',
      )
      return { ...BOOKING_COLUMN_DEFAULTS, ...Object.fromEntries(kept) }
    }
  } catch {
    // Broken storage: fall back to the defaults.
  }
  return { ...BOOKING_COLUMN_DEFAULTS }
}
