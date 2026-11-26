/**
 * Rule-based categorization (research R11): rules are tried by ascending
 * priority, the first match wins, a manual category is never overwritten,
 * and bookings to or from an own account become transfers.
 */
import type { AmountSign, RuleMatchField, RuleOperator, TransactionType } from '@finance/shared'
import { normalizeText } from './dedupe'

export interface Rule {
  id: string
  priority: number
  matchField: RuleMatchField
  operator: RuleOperator
  pattern: string
  amountSign: AmountSign | null
  categoryId: string
  enabled: boolean
}

export interface CategorizableTx {
  type: TransactionType
  amountCents: number
  counterparty?: string | null
  counterpartyIban?: string | null
  purpose?: string | null
  categoryId?: string | null
  categorySource?: 'manual' | 'rule' | 'import' | null
}

export interface CategorizeResult {
  type: TransactionType
  categoryId: string | null
  categorySource: 'manual' | 'rule' | 'import' | null
}

/** Throws if a regex rule pattern does not compile. */
export function assertValidPattern(operator: RuleOperator, pattern: string): void {
  if (operator === 'regex') new RegExp(pattern, 'i')
}

export function matchesRule(rule: Rule, tx: CategorizableTx): boolean {
  if (!rule.enabled) return false
  if (rule.amountSign === 'positive' && tx.amountCents < 0) return false
  if (rule.amountSign === 'negative' && tx.amountCents >= 0) return false
  const raw =
    rule.matchField === 'counterparty'
      ? tx.counterparty
      : rule.matchField === 'purpose'
        ? tx.purpose
        : tx.counterpartyIban
  const value =
    rule.matchField === 'counterparty_iban'
      ? (raw ?? '').replace(/\s+/g, '').toUpperCase()
      : normalizeText(raw)
  const pattern =
    rule.matchField === 'counterparty_iban'
      ? rule.pattern.replace(/\s+/g, '').toUpperCase()
      : normalizeText(rule.pattern)
  if (!value) return false
  switch (rule.operator) {
    case 'contains':
      return value.includes(pattern)
    case 'equals':
      return value === pattern
    case 'starts_with':
      return value.startsWith(pattern)
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(raw ?? '')
      } catch {
        return false
      }
  }
}

/** Cash-flow types rules may categorize; trades, dividends etc. keep their own meaning. */
const CATEGORIZABLE: ReadonlySet<TransactionType> = new Set([
  'income',
  'expense',
  'transfer',
  'fee',
])

export function categorize(
  tx: CategorizableTx,
  rules: readonly Rule[],
  ownIbans: ReadonlySet<string>,
): CategorizeResult {
  const ownTransfer =
    !!tx.counterpartyIban && ownIbans.has(tx.counterpartyIban.replace(/\s+/g, '').toUpperCase())
  const type: TransactionType = ownTransfer && CATEGORIZABLE.has(tx.type) ? 'transfer' : tx.type

  if (tx.categorySource === 'manual') {
    return { type, categoryId: tx.categoryId ?? null, categorySource: 'manual' }
  }
  if (CATEGORIZABLE.has(type)) {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority)
    const rule = sorted.find((candidate) => matchesRule(candidate, tx))
    if (rule) return { type, categoryId: rule.categoryId, categorySource: 'rule' }
  }
  return {
    type,
    categoryId: tx.categoryId ?? null,
    categorySource: tx.categoryId ? (tx.categorySource ?? 'import') : null,
  }
}

/** Rule fields as edited in the category dialog (006). */
export interface RuleDraftShape {
  matchField: Rule['matchField']
  operator: Rule['operator']
  pattern: string
  amountSign?: Rule['amountSign']
}

/** Longest recipient key and pre-filled purpose pattern (006 data model, research R2). */
const MAX_KEY = 200
const PURPOSE_PATTERN = 40

/** Normalized counterparty that identifies a recipient, or null without counterparty. */
export function counterpartyKey(tx: Pick<CategorizableTx, 'counterparty'>): string | null {
  const key = normalizeText(tx.counterparty).slice(0, MAX_KEY)
  return key || null
}

/**
 * Pre-filled rule for "Für ähnliche Buchungen merken" (006 R2): the counterparty, else the
 * IBAN, else the start of the purpose after the posting text ("KARTENZAHLUNG · …").
 */
export function draftRuleFor(
  tx: Pick<CategorizableTx, 'counterparty' | 'counterpartyIban' | 'purpose'>,
): RuleDraftShape | null {
  const key = counterpartyKey(tx)
  if (key) return { matchField: 'counterparty', operator: 'contains', pattern: key }
  const iban = (tx.counterpartyIban ?? '').replace(/\s+/g, '').toUpperCase()
  if (iban) return { matchField: 'counterparty_iban', operator: 'equals', pattern: iban }
  const parts = (tx.purpose ?? '').split(' · ')
  const text = normalizeText(parts.length > 1 ? parts.slice(1).join(' ') : parts[0])
  const pattern = text.slice(0, PURPOSE_PATTERN).trim()
  return pattern ? { matchField: 'purpose', operator: 'contains', pattern } : null
}

/**
 * True when a scope change or a new rule may set this booking's category (006 R3, FR-008):
 * never manual ones, never transfers or trades, only uncategorized or rule-categorized ones.
 */
export function wouldChange(tx: Pick<CategorizableTx, 'type' | 'categorySource'>): boolean {
  if (tx.categorySource === 'manual' || tx.categorySource === 'import') return false
  return tx.type !== 'transfer' && CATEGORIZABLE.has(tx.type)
}
