/**
 * Saving and applying a rule from the category dialog (006 US1, research R3). Shared by the
 * single-booking update, bulk "Kategorie setzen" and accepted suggestions.
 */
import type { RuleDraft } from '@finance/shared'
import { eq, max } from 'drizzle-orm'
import type { AppDatabase } from '../../database/drizzle.module'
import { categorizationRule, transaction } from '../../database/schema'
import { matchesRule, type Rule, wouldChange } from '../../domain/categorize'

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0]
type Db = AppDatabase | Tx

/** Appends the rule at the end of the order and returns it. */
export function appendRule(db: Db, draft: RuleDraft, categoryId: string): Rule {
  const priority =
    (db
      .select({ top: max(categorizationRule.priority) })
      .from(categorizationRule)
      .get()?.top ?? 0) + 1
  return db
    .insert(categorizationRule)
    .values({
      matchField: draft.matchField,
      operator: draft.operator,
      pattern: draft.pattern,
      amountSign: draft.amountSign ?? null,
      categoryId,
      priority,
    })
    .returning()
    .get() as Rule
}

/**
 * Sets the rule's category on every booking it matches that may change (never manual,
 * imported, transfers or trades). Returns the number of bookings changed.
 */
export function applyRule(db: Db, rule: Rule): number {
  let changed = 0
  for (const row of db.select().from(transaction).all()) {
    if (!wouldChange(row) || !matchesRule(rule, row)) continue
    if (row.categoryId === rule.categoryId && row.categorySource === 'rule') continue
    db.update(transaction)
      .set({ categoryId: rule.categoryId, categorySource: 'rule' })
      .where(eq(transaction.id, row.id))
      .run()
    changed++
  }
  return changed
}
