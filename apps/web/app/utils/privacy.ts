import {
  formatEur as eur,
  formatEurCompact as eurCompact,
  formatEurSigned as eurSigned,
  formatPct as pct,
  formatPctSigned as pctSigned,
} from '@finance/shared'

/**
 * Privacy mode (014 US2): while on, every amount and percentage the app formats shows as
 * "•••• €" / "•• %" – in tables, cards, chart axes and tooltips. Kept in step with the owner
 * setting by app.vue; reactive, so computed labels and chart options re-render on a toggle.
 */
export const privacyOn = ref(false)

export const MASKED_EUR = '•••• €'
export const MASKED_PCT = '•• %'

export function formatEur(cents: number): string {
  return privacyOn.value ? MASKED_EUR : eur(cents)
}

export function formatEurSigned(cents: number): string {
  return privacyOn.value ? MASKED_EUR : eurSigned(cents)
}

export function formatEurCompact(cents: number): string {
  return privacyOn.value ? MASKED_EUR : eurCompact(cents)
}

export function formatPct(ratio: number): string {
  return privacyOn.value ? MASKED_PCT : pct(ratio)
}

export function formatPctSigned(ratio: number): string {
  return privacyOn.value ? MASKED_PCT : pctSigned(ratio)
}
