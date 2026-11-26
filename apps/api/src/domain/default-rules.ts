/**
 * Built-in categorization for common merchants (010 R5): generic brand words → default
 * categories ("Main › Sub" of the German default tree). They run after the owner's rules
 * (006), never override a manual category, and use whole words of counterparty or purpose,
 * so "dm" does not match "Admiral". Only generic merchant names live here, never names from
 * the owner's bookings.
 */
import type { Rule } from './categorize'

export interface DefaultRule {
  /** Words matched as whole words (regex alternatives, lower case, no anchors). */
  words: readonly string[]
  /** Category path "Main" or "Main › Sub" of the default tree. */
  category: string
  /** Only outflows (most merchants) unless set to `any`. */
  sign?: 'negative' | 'any'
}

export const DEFAULT_RULES: readonly DefaultRule[] = [
  { words: ['paypal'], category: 'Shopping und Unterhaltung' },
  { words: ['amazon', 'amzn'], category: 'Shopping und Unterhaltung' },
  { words: ['ebay', 'otto gmbh', 'temu', 'shein'], category: 'Shopping und Unterhaltung' },
  {
    words: ['zalando', 'h&m', 'c&a', 'primark', 'about you'],
    category: 'Shopping und Unterhaltung › Kleidung',
  },
  {
    words: ['mediamarkt', 'media markt', 'saturn', 'apple com bill'],
    category: 'Shopping und Unterhaltung › Elektronik',
  },
  {
    words: ['netflix', 'spotify', 'disney plus', 'disney\\+', 'dazn', 'youtube premium', 'audible'],
    category: 'Shopping und Unterhaltung › Streaming',
  },
  { words: ['deutsche post', 'dhl', 'hermes'], category: 'Shopping und Unterhaltung' },
  { words: ['klarna'], category: 'Bank und Kredit' },
  {
    words: ['kontofuehrung', 'kontoführung', 'kontoentgelt'],
    category: 'Bank und Kredit › Kontoführung',
  },
  {
    words: ['telekom', 'vodafone', 'o2', 'telefonica', 'congstar', '1&1', 'freenet'],
    category: 'Lebenshaltung › Handy',
  },
  {
    words: [
      'rewe',
      'lidl',
      'aldi',
      'edeka',
      'kaufland',
      'netto',
      'penny',
      'norma',
      'globus',
      'studentenwerk',
      'mensa',
      'baeckerei',
      'bäckerei',
      'backhaus',
    ],
    category: 'Lebenshaltung › Lebensmittel und Getränke',
  },
  {
    words: ['dm drogerie', 'dm', 'rossmann', 'mueller drogerie'],
    category: 'Lebenshaltung › Sonstige',
  },
  { words: ['apotheke'], category: 'Gesundheit und Wellness › Arznei- und Heilmittel' },
  {
    words: ['vattenfall', 'stadtwerke', 'e on', 'eon energie', 'enbw', 'naturstrom', 'lichtblick'],
    category: 'Wohnen › Strom',
  },
  { words: ['rundfunk ard', 'beitragsservice'], category: 'Wohnen › Wohnnebenkosten' },
  { words: ['lebensversicherung'], category: 'Versicherung › Risiko-Lebensversicherung' },
  { words: ['versicherung', 'allianz', 'huk coburg'], category: 'Versicherung' },
  { words: ['ikea', 'obi', 'bauhaus', 'hornbach', 'toom'], category: 'Wohnen' },
]

/** Priorities after every owner rule (owner rules count from 1). */
const DEFAULT_PRIORITY = 1_000_000

const escapeWord = (word: string) =>
  word
    .split(/\s+/)
    .map((part) => part.replace(/[.*?^${}()|[\]]/g, '\\$&'))
    .join('\\W+')

/**
 * The default rules as ordinary rules for `categorize()`: one rule per field (counterparty and
 * purpose) with a whole-word pattern. Rules whose category is missing in `idByPath` are left out.
 */
export function defaultRulesFor(idByPath: ReadonlyMap<string, string>): Rule[] {
  const rules: Rule[] = []
  DEFAULT_RULES.forEach((rule, index) => {
    const categoryId = idByPath.get(rule.category)
    if (!categoryId) return
    // Whole words; the rule engine compiles with the `i` flag only, so letters are listed.
    const pattern = `(?<![a-z0-9äöüß])(?:${rule.words.map(escapeWord).join('|')})(?![a-z0-9äöüß])`
    for (const [offset, matchField] of (['counterparty', 'purpose'] as const).entries()) {
      rules.push({
        id: `default:${index}:${matchField}`,
        priority: DEFAULT_PRIORITY + index * 2 + offset,
        matchField,
        operator: 'regex',
        pattern,
        amountSign: rule.sign === 'any' ? null : 'negative',
        categoryId,
        enabled: true,
      })
    }
  })
  return rules
}

/** "Main › Sub" → id for the default categories (input: id, name, parent name). */
export function categoryPaths(
  rows: readonly { id: string; name: string; parentName: string | null }[],
): Map<string, string> {
  return new Map(
    rows.map((row) => [row.parentName ? `${row.parentName} › ${row.name}` : row.name, row.id]),
  )
}
