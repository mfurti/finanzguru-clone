/**
 * Transaction fingerprints for idempotent imports (research R10).
 * fingerprint = sha256(accountId | bookingDate | amountCents | counterparty | purpose | occurrenceIndex)
 * The occurrence index keeps two genuinely identical bookings on the same day.
 * A source-native reference (`source`, `sourceRef`) takes precedence in the pipeline.
 */
import { createHash } from 'node:crypto'

export interface FingerprintInput {
  bookingDate: string
  amountCents: number
  counterparty?: string | null
  purpose?: string | null
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

function baseKey(accountId: string, tx: FingerprintInput): string {
  return [
    accountId,
    tx.bookingDate,
    tx.amountCents,
    normalizeText(tx.counterparty),
    normalizeText(tx.purpose),
  ].join('|')
}

export function fingerprint(
  accountId: string,
  tx: FingerprintInput,
  occurrenceIndex: number,
): string {
  return createHash('sha256')
    .update(`${baseKey(accountId, tx)}|${occurrenceIndex}`)
    .digest('hex')
}

/** Fingerprints for a batch in order; identical rows get increasing occurrence indexes. */
export function fingerprintBatch(accountId: string, txs: readonly FingerprintInput[]): string[] {
  const seen = new Map<string, number>()
  return txs.map((tx) => {
    const key = baseKey(accountId, tx)
    const index = seen.get(key) ?? 0
    seen.set(key, index + 1)
    return fingerprint(accountId, tx, index)
  })
}
