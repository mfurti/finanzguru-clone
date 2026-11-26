import { describe, expect, it } from 'vitest'
import { categorize, type Rule } from '../../src/domain/categorize'
import {
  categorizeWithDefaults,
  DEFAULT_RULES,
  defaultRulesFor,
} from '../../src/domain/default-rules'
import { DEFAULT_CATEGORIES } from '../../src/database/seed'

/** Every path of the default tree mapped to itself as id. */
const paths = new Map<string, string>(
  DEFAULT_CATEGORIES.flatMap((main) => [
    [main.name, main.name] as [string, string],
    ...(main.children ?? []).map((child): [string, string] => [
      `${main.name} › ${child}`,
      `${main.name} › ${child}`,
    ]),
  ]),
)
const defaults = defaultRulesFor(paths)
const expense = (counterparty: string | null, purpose: string | null = null) => ({
  type: 'expense' as const,
  amountCents: -1999,
  counterparty,
  purpose,
})
const categoryOf = (tx: ReturnType<typeof expense>, rules: Rule[] = defaults) =>
  categorize(tx, rules, new Set()).categoryId

describe('built-in merchant rules (010 T010)', () => {
  it('every rule points to a category of the default tree', () => {
    expect(DEFAULT_RULES.filter((rule) => !paths.has(rule.category))).toEqual([])
    expect(defaults).toHaveLength(DEFAULT_RULES.length * 2)
  })

  it.each([
    ['PayPal (Europe) S.a.r.l. et Cie', 'Shopping und Unterhaltung'],
    ['AMAZON PAYMENTS EUROPE S.C.A.', 'Shopping und Unterhaltung'],
    ['Klarna Bank AB (publ)', 'Bank und Kredit'],
    ['Telekom Deutschland GmbH', 'Lebenshaltung › Handy'],
    ['NETFLIX.COM', 'Shopping und Unterhaltung › Streaming'],
    ['REWE Markt GmbH', 'Lebenshaltung › Lebensmittel und Getränke'],
    ['dm-drogerie markt', 'Lebenshaltung › Sonstige'],
    ['Rosen-Apotheke', 'Gesundheit und Wellness › Arznei- und Heilmittel'],
    ['Stadtwerke Musterstadt GmbH', 'Wohnen › Strom'],
    ['Rundfunk ARD, ZDF, DRadio', 'Wohnen › Wohnnebenkosten'],
    ['R + V Lebensversicherung AG', 'Versicherung › Risiko-Lebensversicherung'],
    ['Deutsche Post AG', 'Shopping und Unterhaltung'],
  ])('%s → %s', (counterparty, category) => {
    expect(categoryOf(expense(counterparty))).toBe(category)
  })

  it('matches card payments by purpose and only whole words', () => {
    expect(categoryOf(expense(null, 'KARTENZAHLUNG · LIDL SAGT DANKE'))).toBe(
      'Lebenshaltung › Lebensmittel und Getränke',
    )
    expect(categoryOf(expense('Admiral Spielhalle'))).toBeNull()
    expect(categoryOf(expense('Klarnamen Verlag'))).toBeNull()
  })

  it('leaves income alone and lets owner rules and manual categories win', () => {
    expect(categoryOf({ ...expense('PayPal'), amountCents: 2000 })).toBeNull()
    const owner: Rule = {
      id: 'own',
      priority: 1,
      matchField: 'counterparty',
      operator: 'contains',
      pattern: 'paypal',
      amountSign: null,
      categoryId: 'Freizeit, Hobbies und Soziales',
      enabled: true,
    }
    expect(categoryOf(expense('PayPal Europe'), [...defaults, owner])).toBe(
      'Freizeit, Hobbies und Soziales',
    )
    const manual = categorize(
      { ...expense('PayPal'), categoryId: 'mine', categorySource: 'manual' as const },
      defaults,
      new Set(),
    )
    expect(manual.categoryId).toBe('mine')
  })
})

describe('defaults only fill empty categories (010 T011)', () => {
  it('keeps an imported category and uses defaults only for empty ones', () => {
    const imported = categorizeWithDefaults(
      { ...expense('PayPal'), categoryId: 'bank-category', categorySource: 'import' as const },
      [],
      defaults,
      new Set(),
    )
    expect(imported.categoryId).toBe('bank-category')
    const empty = categorizeWithDefaults(expense('PayPal'), [], defaults, new Set())
    expect(empty).toMatchObject({
      categoryId: 'Shopping und Unterhaltung',
      categorySource: 'rule',
    })
  })
})
