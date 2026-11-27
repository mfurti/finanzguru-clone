import { describe, expect, it } from 'vitest'
import {
  detectInsuranceSuggestions,
  type InsuranceBooking,
  normalizeCounterparty,
} from '../../src/domain/insurance-suggestions'

const pay = (
  date: string,
  amountCents: number,
  counterparty = 'Muster Lebensversicherung AG',
  categoryName: string | null = 'Risiko-Lebensversicherung',
): InsuranceBooking => ({ date, amountCents, counterparty, categoryName })

const monthly = [pay('2026-08-01', -2362), pay('2026-09-01', -2362), pay('2026-10-01', -2362)]

describe('insurance suggestions (012 T016)', () => {
  it('suggests a monthly contract with type from the category', () => {
    expect(detectInsuranceSuggestions(monthly, [], new Set())).toEqual([
      {
        key: 'musterlebensversicherungag:monthly',
        counterparty: 'Muster Lebensversicherung AG',
        amountCents: 2362,
        interval: 'monthly',
        type: 'term_life',
        count: 3,
        firstDate: '2026-08-01',
        lastDate: '2026-10-01',
      },
    ])
  })

  it.each([
    ['quarterly', ['2026-01-15', '2026-04-15', '2026-07-15']],
    ['semiannual', ['2025-07-01', '2026-01-01']],
    ['annual', ['2024-03-01', '2025-03-01', '2026-03-02']],
  ])('recognizes %s payments', (interval, dates) => {
    const result = detectInsuranceSuggestions(
      dates.map((date) => pay(date, -12000, 'Haftpflicht Kasse', 'Haftpflicht')),
      [],
      new Set(),
    )
    expect(result[0]).toMatchObject({ interval, type: 'liability' })
  })

  it('needs at least two payments, a regular rhythm and similar amounts', () => {
    expect(detectInsuranceSuggestions([monthly[0]!], [], new Set())).toEqual([])
    expect(
      detectInsuranceSuggestions(
        [pay('2026-01-01', -2000), pay('2026-03-20', -2000)],
        [],
        new Set(),
      ),
    ).toEqual([])
    expect(
      detectInsuranceSuggestions(
        [pay('2026-08-01', -2000), pay('2026-09-01', -4000)],
        [],
        new Set(),
      ),
    ).toEqual([])
  })

  it('skips refunds, existing contracts and dismissed suggestions', () => {
    expect(
      detectInsuranceSuggestions([pay('2026-08-01', 2362), pay('2026-09-01', 2362)], [], new Set()),
    ).toEqual([])
    expect(detectInsuranceSuggestions(monthly, ['Muster Lebensversicherung'], new Set())).toEqual(
      [],
    )
    expect(
      detectInsuranceSuggestions(monthly, [], new Set(['musterlebensversicherungag:monthly'])),
    ).toEqual([])
  })

  it('normalizes counterparty names', () => {
    expect(normalizeCounterparty('R + V Lebensversicherung AG')).toBe('rvlebensversicherungag')
  })
})
