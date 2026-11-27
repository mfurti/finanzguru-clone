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
/** Display rounding (014 US3): whole euros instead of cents; computations stay in cents. */
export const wholeEuros = ref(false)

const whole = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const wholeSigned = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
})
const spaces = (value: string) => value.replace(/[\u00A0\u202F]/g, ' ')

export const MASKED_EUR = '•••• €'
export const MASKED_PCT = '•• %'

export function formatEur(cents: number): string {
  if (privacyOn.value) return MASKED_EUR
  return wholeEuros.value ? spaces(whole.format(cents / 100)) : eur(cents)
}

export function formatEurSigned(cents: number): string {
  if (privacyOn.value) return MASKED_EUR
  return wholeEuros.value ? spaces(wholeSigned.format(cents / 100)) : eurSigned(cents)
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
