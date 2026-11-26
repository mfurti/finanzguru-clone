/**
 * Visible columns of the Transaktionen table (007 R1). Like the reference, Konto and
 * Verwendungszweck are optional and off by default, so Betrag always fits; a stored choice
 * that turned them on explicitly keeps them.
 */
export const BOOKING_COLUMN_DEFAULTS: Readonly<Record<string, boolean>> = {
  account: false,
  purpose: false,
}

/** Merges a stored choice (may be partial or broken JSON) over the defaults. */
export function initialColumnVisibility(stored: string | null): Record<string, boolean> {
  try {
    const parsed = JSON.parse(stored ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...BOOKING_COLUMN_DEFAULTS, ...(parsed as Record<string, boolean>) }
    }
  } catch {
    // Broken storage: fall back to the defaults.
  }
  return { ...BOOKING_COLUMN_DEFAULTS }
}
