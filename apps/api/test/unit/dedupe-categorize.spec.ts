import { describe, expect, it } from 'vitest'
import {
  assertValidPattern,
  categorize,
  counterpartyKey,
  draftRuleFor,
  type Rule,
  wouldChange,
} from '../../src/domain/categorize'
import { fingerprint, fingerprintBatch } from '../../src/domain/dedupe'

describe('fingerprints', () => {
  const grocery = {
    bookingDate: '2026-11-04',
    amountCents: -6437,
    counterparty: 'Demo Supermarkt',
    purpose: 'Einkauf',
  }

  it('is stable and ignores case and whitespace', () => {
    expect(fingerprint('acc', grocery, 0)).toBe(
      fingerprint('acc', { ...grocery, counterparty: '  demo   SUPERMARKT ' }, 0),
    )
  })

  it('differs per account and amount', () => {
    expect(fingerprint('acc', grocery, 0)).not.toBe(fingerprint('other', grocery, 0))
    expect(fingerprint('acc', grocery, 0)).not.toBe(
      fingerprint('acc', { ...grocery, amountCents: -6438 }, 0),
    )
  })

  it('keeps two identical bookings on the same day apart, reproducibly', () => {
    const first = fingerprintBatch('acc', [grocery, grocery])
    expect(first[0]).not.toBe(first[1])
    expect(fingerprintBatch('acc', [grocery, grocery])).toEqual(first)
  })
})

describe('categorize', () => {
  const rule = (overrides: Partial<Rule>): Rule => ({
    id: 'r',
    priority: 1,
    matchField: 'counterparty',
    operator: 'contains',
    pattern: 'supermarkt',
    amountSign: null,
    categoryId: 'groceries',
    enabled: true,
    ...overrides,
  })
  const tx = {
    type: 'expense' as const,
    amountCents: -6437,
    counterparty: 'Demo Supermarkt',
    purpose: 'Einkauf',
  }

  it('applies the first matching rule by priority', () => {
    const rules = [
      rule({ id: 'b', priority: 2, categoryId: 'shopping' }),
      rule({ id: 'a', priority: 1 }),
    ]
    expect(categorize(tx, rules, new Set())).toEqual({
      type: 'expense',
      categoryId: 'groceries',
      categorySource: 'rule',
    })
  })

  it('supports equals, starts_with, regex, IBAN and amount sign', () => {
    const none = new Set<string>()
    expect(
      categorize(tx, [rule({ operator: 'equals', pattern: 'demo supermarkt' })], none).categoryId,
    ).toBe('groceries')
    expect(
      categorize(tx, [rule({ operator: 'starts_with', pattern: 'DEMO' })], none).categoryId,
    ).toBe('groceries')
    expect(
      categorize(tx, [rule({ operator: 'regex', pattern: '^Demo\\s+Super' })], none).categoryId,
    ).toBe('groceries')
    expect(categorize(tx, [rule({ amountSign: 'positive' })], none).categoryId).toBeNull()
    expect(
      categorize(
        { ...tx, counterpartyIban: 'DE02120300000000202051' },
        [
          rule({
            matchField: 'counterparty_iban',
            operator: 'equals',
            pattern: 'DE02 1203 0000 0000 2020 51',
          }),
        ],
        none,
      ).categoryId,
    ).toBe('groceries')
  })

  it('never overwrites a manual category', () => {
    const manual = { ...tx, categoryId: 'mine', categorySource: 'manual' as const }
    expect(categorize(manual, [rule({})], new Set())).toEqual({
      type: 'expense',
      categoryId: 'mine',
      categorySource: 'manual',
    })
  })

  it('turns bookings to own accounts into transfers', () => {
    const result = categorize(
      { ...tx, counterpartyIban: 'DE89370400440532013000' },
      [],
      new Set(['DE89370400440532013000']),
    )
    expect(result.type).toBe('transfer')
  })

  it('does not categorize trades', () => {
    expect(categorize({ ...tx, type: 'buy' }, [rule({})], new Set()).categoryId).toBeNull()
  })

  it('rejects invalid regex patterns', () => {
    expect(() => assertValidPattern('regex', '(unclosed')).toThrow()
    expect(() => assertValidPattern('contains', '(unclosed')).not.toThrow()
  })
})

describe('rule helpers for the category dialog (006 T004)', () => {
  it('builds the recipient key from the normalized counterparty', () => {
    expect(counterpartyKey({ counterparty: '  STADTWERKE   Konstanz GmbH ' })).toBe(
      'stadtwerke konstanz gmbh',
    )
    expect(counterpartyKey({ counterparty: '   ' })).toBeNull()
    expect(counterpartyKey({ counterparty: null })).toBeNull()
  })

  it('pre-fills the rule from counterparty, then IBAN, then purpose', () => {
    expect(draftRuleFor({ counterparty: 'Vermieter', purpose: 'Miete' })).toEqual({
      matchField: 'counterparty',
      operator: 'contains',
      pattern: 'vermieter',
    })
    expect(draftRuleFor({ counterpartyIban: 'DE02 1203 0000 0000 2020 51' })).toEqual({
      matchField: 'counterparty_iban',
      operator: 'equals',
      pattern: 'DE02120300000000202051',
    })
    expect(draftRuleFor({ purpose: 'KARTENZAHLUNG · Bäckerei Müller Filiale 12' })).toEqual({
      matchField: 'purpose',
      operator: 'contains',
      pattern: 'bäckerei müller filiale 12',
    })
    expect(draftRuleFor({})).toBeNull()
  })

  it('never lets rules change manual, imported, transfer or trade bookings', () => {
    expect(wouldChange({ type: 'expense', categorySource: null })).toBe(true)
    expect(wouldChange({ type: 'income', categorySource: 'rule' })).toBe(true)
    expect(wouldChange({ type: 'expense', categorySource: 'manual' })).toBe(false)
    expect(wouldChange({ type: 'expense', categorySource: 'import' })).toBe(false)
    expect(wouldChange({ type: 'transfer', categorySource: null })).toBe(false)
    expect(wouldChange({ type: 'buy', categorySource: null })).toBe(false)
  })
})
