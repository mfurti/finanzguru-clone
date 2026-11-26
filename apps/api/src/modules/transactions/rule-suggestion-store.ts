/**
 * Rule suggestions (006 US2, research R4): counted on manual categorizations, listed while
 * open, accepted into a rule or declined for good. Plain functions so the transactions and the
 * categories module share them without a module cycle.
 */
import type { RuleSuggestionDto } from '@finance/shared'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { AppDatabase } from '../../database/drizzle.module'
import { categorizationRule, ruleSuggestion, transaction } from '../../database/schema'
import { counterpartyKey, matchesRule, type Rule, wouldChange } from '../../domain/categorize'
import { shouldSuggest } from '../../domain/rule-suggestions'
import { appendRule, applyRule } from './rule-apply'

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0]
type Db = AppDatabase | Tx
type SuggestionRow = typeof ruleSuggestion.$inferSelect

/** The rule a suggestion stands for: counterparty contains the recipient key (research R2). */
const ruleFor = (row: SuggestionRow): Rule => ({
  id: row.id,
  priority: 0,
  matchField: 'counterparty',
  operator: 'contains',
  pattern: row.counterpartyKey,
  amountSign: null,
  categoryId: row.categoryId,
  enabled: true,
})

/** True when an enabled rule already categorizes bookings of this recipient. */
function coveredByRule(
  db: Db,
  key: string,
  bookings: (typeof transaction.$inferSelect)[],
): boolean {
  const rules = db
    .select()
    .from(categorizationRule)
    .where(eq(categorizationRule.enabled, true))
    .all() as Rule[]
  const sample = bookings.find((row) => counterpartyKey(row) === key)
  return !!sample && rules.some((rule) => matchesRule(rule, sample))
}

/** Suggestion as shown in the UI: display name of the recipient and affected bookings. */
function toDto(
  row: SuggestionRow,
  bookings: (typeof transaction.$inferSelect)[],
): RuleSuggestionDto {
  const rule = ruleFor(row)
  const mine = bookings.filter((item) => counterpartyKey(item) === row.counterpartyKey)
  return {
    id: row.id,
    counterparty: mine[0]?.counterparty?.trim() || row.counterpartyKey,
    categoryId: row.categoryId,
    count: row.count,
    affected: bookings.filter((item) => wouldChange(item) && matchesRule(rule, item)).length,
  }
}

/**
 * Counts one manual categorization and returns the suggestion when it is due. Saving a rule
 * for the same pair ("merken") marks the suggestion accepted instead.
 */
export function recordManualCategorization(
  db: Db,
  key: string,
  categoryId: string,
  ruleSaved: boolean,
): RuleSuggestionDto | null {
  const row = db
    .insert(ruleSuggestion)
    .values({
      counterpartyKey: key,
      categoryId,
      count: 1,
      status: ruleSaved ? 'accepted' : 'open',
    })
    .onConflictDoUpdate({
      target: [ruleSuggestion.counterpartyKey, ruleSuggestion.categoryId],
      set: {
        count: sql`${ruleSuggestion.count} + 1`,
        updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        ...(ruleSaved && { status: 'accepted' as const }),
      },
    })
    .returning()
    .get()
  const bookings = db.select().from(transaction).all()
  if (!shouldSuggest(row.count, row.status, coveredByRule(db, key, bookings))) return null
  return toDto(row, bookings)
}

/** Open suggestions that are due, newest first. */
export function openSuggestions(db: Db): RuleSuggestionDto[] {
  const rows = db
    .select()
    .from(ruleSuggestion)
    .where(eq(ruleSuggestion.status, 'open'))
    .orderBy(asc(ruleSuggestion.updatedAt))
    .all()
    .reverse()
  if (rows.length === 0) return []
  const bookings = db.select().from(transaction).all()
  return rows
    .filter((row) =>
      shouldSuggest(row.count, row.status, coveredByRule(db, row.counterpartyKey, bookings)),
    )
    .map((row) => toDto(row, bookings))
}

/** Accept: saves the pre-filled rule, applies it, marks the suggestion accepted. */
export function acceptSuggestion(
  db: AppDatabase,
  id: string,
): { ruleId: string; applied: number } | null {
  return db.transaction((tx) => {
    const row = tx.select().from(ruleSuggestion).where(eq(ruleSuggestion.id, id)).get()
    if (!row || row.status !== 'open') return null
    const rule = appendRule(
      tx,
      { matchField: 'counterparty', operator: 'contains', pattern: row.counterpartyKey },
      row.categoryId,
    )
    tx.update(ruleSuggestion)
      .set({ status: 'accepted' })
      .where(and(eq(ruleSuggestion.id, id)))
      .run()
    return { ruleId: rule.id, applied: applyRule(tx, rule) }
  })
}

/** Decline: the pair is never suggested again. Returns false when unknown. */
export function declineSuggestion(db: AppDatabase, id: string): boolean {
  return (
    db.update(ruleSuggestion).set({ status: 'declined' }).where(eq(ruleSuggestion.id, id)).run()
      .changes > 0
  )
}
