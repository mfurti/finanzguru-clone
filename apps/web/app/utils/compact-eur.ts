import { MASKED_EUR, privacyOn } from './privacy'

const ONE_DECIMAL = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const WHOLE = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })

/**
 * Compact euro label for chart axes like the reference (007 R6): "850 €", "5K €", "2,5K €",
 * "1,2M €". Input in cents; negative values keep their sign.
 */
export function compactEur(cents: number): string {
  if (privacyOn.value) return MASKED_EUR
  const euros = cents / 100
  const size = Math.abs(euros)
  if (size >= 1_000_000) return `${ONE_DECIMAL.format(euros / 1_000_000)}M €`
  if (size >= 1_000) return `${ONE_DECIMAL.format(euros / 1_000)}K €`
  return `${WHOLE.format(euros)} €`
}
