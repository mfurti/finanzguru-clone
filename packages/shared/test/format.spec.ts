import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatEur,
  formatEurSigned,
  formatPct,
  formatPctSigned,
  isValidIban,
  isValidIsin,
  normalizeIban,
  signTone,
} from '../src/index'

describe('de-DE formatting', () => {
  it('formats cents as euro', () => {
    expect(formatEur(185645)).toBe('1.856,45 €')
    expect(formatEur(0)).toBe('0,00 €')
    expect(formatEur(-177824)).toBe('-1.778,24 €')
  })

  it('formats signed amounts', () => {
    expect(formatEurSigned(14740)).toBe('+147,40 €')
    expect(formatEurSigned(-13423)).toBe('-134,23 €')
    expect(formatEurSigned(0)).toBe('0,00 €')
  })

  it('formats percentages', () => {
    expect(formatPct(0.0815)).toBe('8,15 %')
    expect(formatPctSigned(0.1083)).toBe('+10,83 %')
    expect(formatPctSigned(-0.0495)).toBe('-4,95 %')
  })

  it('formats dates', () => {
    expect(formatDate('2026-06-12')).toBe('12.06.2026')
  })

  it('maps signs to tones', () => {
    expect(signTone(1)).toBe('positive')
    expect(signTone(-1)).toBe('negative')
    expect(signTone(0)).toBe('neutral')
  })
})

describe('validators', () => {
  it('validates IBAN checksums', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true)
    expect(isValidIban('DE89370400440532013001')).toBe(false)
    expect(isValidIban('GB82WEST12345698765432')).toBe(true)
    expect(isValidIban('not an iban')).toBe(false)
    expect(normalizeIban('de89 3704')).toBe('DE893704')
  })

  it('validates ISIN check digits', () => {
    expect(isValidIsin('IE00B4L5Y983')).toBe(true)
    expect(isValidIsin('US0378331005')).toBe(true)
    expect(isValidIsin('DE0007164600')).toBe(true)
    expect(isValidIsin('IE00B4L5Y984')).toBe(false)
    expect(isValidIsin('IE00B4L5Y98')).toBe(false)
  })
})
