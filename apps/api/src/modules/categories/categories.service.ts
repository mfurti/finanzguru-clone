import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type {
  CategorizationRuleDto,
  CategorizationRuleInput,
  CategoryNode,
  CreateCategoryInput,
  RuleDraft,
  RulePreviewResult,
  RuleSuggestionDto,
  UpdateCategoryInput,
} from '@finance/shared'
import { and, asc, count, eq, isNull, max, ne, or } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { categorizationRule, category, transaction } from '../../database/schema'
import {
  acceptSuggestion,
  declineSuggestion,
  openSuggestions,
} from '../transactions/rule-suggestion-store'
import {
  assertValidPattern,
  categorize,
  matchesRule,
  type Rule,
  wouldChange,
} from '../../domain/categorize'
import { loadDefaultRules } from './default-rules.query'

type CategoryRow = typeof category.$inferSelect

@Injectable()
export class CategoriesService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  tree(): CategoryNode[] {
    const rows = this.db.select().from(category).orderBy(asc(category.name)).all()
    const node = (row: CategoryRow): CategoryNode => ({
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      kind: row.kind,
      color: row.color,
      icon: row.icon,
      isDefault: row.isDefault,
      children: rows.filter((child) => child.parentId === row.id).map(node),
    })
    return rows.filter((row) => !row.parentId).map(node)
  }

  create(input: CreateCategoryInput): CategoryNode {
    if (input.parentId) this.assertTopLevel(input.parentId)
    this.assertUniqueName(input.name, input.parentId ?? null)
    const row = this.db
      .insert(category)
      .values({ ...input, parentId: input.parentId ?? null, isDefault: false })
      .returning()
      .get()
    return { ...row, children: [] }
  }

  update(id: string, input: UpdateCategoryInput): CategoryNode {
    const row = this.get(id)
    const parentId = input.parentId === undefined ? row.parentId : input.parentId
    if (parentId) {
      if (parentId === id)
        throw new BadRequestException('Kategorie kann nicht ihr eigener Elternteil sein')
      this.assertTopLevel(parentId)
      const hasChildren =
        this.db.select({ n: count() }).from(category).where(eq(category.parentId, id)).get()?.n ?? 0
      if (hasChildren > 0)
        throw new BadRequestException('Kategorien sind höchstens zwei Ebenen tief')
    }
    if (input.name !== undefined || input.parentId !== undefined) {
      this.assertUniqueName(input.name ?? row.name, parentId ?? null, id)
    }
    this.db
      .update(category)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.kind !== undefined && { kind: input.kind }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.parentId !== undefined && { parentId: input.parentId ?? null }),
      })
      .where(eq(category.id, id))
      .run()
    return this.tree()
      .flatMap((main) => [main, ...main.children])
      .find((node) => node.id === id)!
  }

  remove(id: string): void {
    const row = this.get(id)
    if (row.isDefault)
      throw new ConflictException('Standardkategorien können nicht gelöscht werden')
    const children =
      this.db.select({ n: count() }).from(category).where(eq(category.parentId, id)).get()?.n ?? 0
    if (children > 0) throw new ConflictException('Kategorie hat Unterkategorien')
    // Bookings keep existing and become uncategorized (FK on delete set null); rules are removed.
    this.db.delete(category).where(eq(category.id, id)).run()
  }

  rules(): CategorizationRuleDto[] {
    return this.db.select().from(categorizationRule).orderBy(asc(categorizationRule.priority)).all()
  }

  createRule(input: CategorizationRuleInput): CategorizationRuleDto {
    this.validateRule(input)
    const priority =
      (this.db
        .select({ top: max(categorizationRule.priority) })
        .from(categorizationRule)
        .get()?.top ?? 0) + 1
    return this.db
      .insert(categorizationRule)
      .values({ ...input, amountSign: input.amountSign ?? null, priority })
      .returning()
      .get()
  }

  updateRule(
    id: string,
    input: Partial<CategorizationRuleInput> & { priority?: number },
  ): CategorizationRuleDto {
    const rule = this.db
      .select()
      .from(categorizationRule)
      .where(eq(categorizationRule.id, id))
      .get()
    if (!rule) throw new NotFoundException('Regel nicht gefunden')
    this.validateRule({ ...rule, ...input } as CategorizationRuleInput)
    return this.db.transaction((tx) => {
      if (input.priority !== undefined && input.priority !== rule.priority) {
        // Swap with the rule that holds the target priority (priorities stay unique).
        const other = tx
          .select()
          .from(categorizationRule)
          .where(eq(categorizationRule.priority, input.priority))
          .get()
        if (other) {
          tx.update(categorizationRule)
            .set({ priority: -1 })
            .where(eq(categorizationRule.id, id))
            .run()
          tx.update(categorizationRule)
            .set({ priority: rule.priority })
            .where(eq(categorizationRule.id, other.id))
            .run()
        }
      }
      return tx
        .update(categorizationRule)
        .set({
          ...(input.matchField !== undefined && { matchField: input.matchField }),
          ...(input.operator !== undefined && { operator: input.operator }),
          ...(input.pattern !== undefined && { pattern: input.pattern }),
          ...(input.amountSign !== undefined && { amountSign: input.amountSign }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.priority !== undefined && { priority: input.priority }),
        })
        .where(eq(categorizationRule.id, id))
        .returning()
        .get()
    })
  }

  /**
   * New order of all rules (006 R5): the list must hold every rule id exactly once. Priorities
   * are rewritten in two passes so the unique constraint never sees a duplicate.
   */
  reorderRules(ids: readonly string[]): CategorizationRuleDto[] {
    const existing = this.db.select({ id: categorizationRule.id }).from(categorizationRule).all()
    const known = new Set(existing.map((row) => row.id))
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !known.has(id))
    ) {
      throw new BadRequestException('Die Reihenfolge muss jede Regel genau einmal enthalten')
    }
    this.db.transaction((tx) => {
      ids.forEach((id, index) => {
        tx.update(categorizationRule)
          .set({ priority: -(index + 1) })
          .where(eq(categorizationRule.id, id))
          .run()
      })
      ids.forEach((id, index) => {
        tx.update(categorizationRule)
          .set({ priority: index + 1 })
          .where(eq(categorizationRule.id, id))
          .run()
      })
    })
    return this.rules()
  }

  /** Due "Regel anlegen?" suggestions (006 US2). */
  suggestions(): RuleSuggestionDto[] {
    return openSuggestions(this.db)
  }

  acceptSuggestion(id: string): { ruleId: string; applied: number } {
    const result = acceptSuggestion(this.db, id)
    if (!result) throw new NotFoundException('Vorschlag nicht gefunden')
    return result
  }

  declineSuggestion(id: string): void {
    if (!declineSuggestion(this.db, id)) throw new NotFoundException('Vorschlag nicht gefunden')
  }

  removeRule(id: string): void {
    const result = this.db.delete(categorizationRule).where(eq(categorizationRule.id, id)).run()
    if (result.changes === 0) throw new NotFoundException('Regel nicht gefunden')
  }

  /**
   * How many bookings a draft rule matches, and how many it would change (006 R6): manual,
   * imported, transfer and trade bookings are counted as matches but never changed.
   */
  preview(draft: RuleDraft): RulePreviewResult {
    try {
      assertValidPattern(draft.operator, draft.pattern)
    } catch {
      throw new BadRequestException('Regulärer Ausdruck ist ungültig')
    }
    const rule: Rule = {
      id: 'preview',
      priority: 0,
      matchField: draft.matchField,
      operator: draft.operator,
      pattern: draft.pattern,
      amountSign: draft.amountSign ?? null,
      categoryId: 'preview',
      enabled: true,
    }
    let matches = 0
    let changes = 0
    for (const row of this.db.select().from(transaction).all()) {
      if (!matchesRule(rule, row)) continue
      matches++
      if (wouldChange(row)) changes++
    }
    return { matches, wouldChange: changes }
  }

  /** Re-runs all rules on unreviewed bookings that have no manual category. */
  applyRules(): { updated: number } {
    const rules = this.rules() as Rule[]
    // Built-in merchant rules fill only bookings without any category (010 R5).
    const defaults = loadDefaultRules(this.db)
    return this.db.transaction((tx) => {
      const rows = tx
        .select()
        .from(transaction)
        .where(
          and(
            eq(transaction.reviewStatus, 'unreviewed'),
            or(isNull(transaction.categorySource), ne(transaction.categorySource, 'manual')),
          ),
        )
        .all()
      let updated = 0
      for (const row of rows) {
        const owner = categorize(
          { ...row, categoryId: null, categorySource: null },
          rules,
          new Set(),
        )
        const result =
          owner.categoryId || row.categoryId
            ? owner
            : categorize({ ...row, categoryId: null, categorySource: null }, defaults, new Set())
        if (result.categorySource !== 'rule' || result.categoryId === row.categoryId) continue
        tx.update(transaction)
          .set({ categoryId: result.categoryId, categorySource: 'rule' })
          .where(eq(transaction.id, row.id))
          .run()
        updated++
      }
      return { updated }
    })
  }

  private get(id: string): CategoryRow {
    const row = this.db.select().from(category).where(eq(category.id, id)).get()
    if (!row) throw new NotFoundException('Kategorie nicht gefunden')
    return row
  }

  /** Max depth 2: a parent must itself be top-level. */
  private assertTopLevel(parentId: string): void {
    const parent = this.get(parentId)
    if (parent.parentId) throw new BadRequestException('Kategorien sind höchstens zwei Ebenen tief')
  }

  private assertUniqueName(name: string, parentId: string | null, exceptId?: string): void {
    const clash = this.db
      .select({ id: category.id })
      .from(category)
      .where(
        and(
          eq(category.name, name),
          parentId ? eq(category.parentId, parentId) : isNull(category.parentId),
        ),
      )
      .get()
    if (clash && clash.id !== exceptId)
      throw new ConflictException('Name existiert bereits auf dieser Ebene')
  }

  private validateRule(input: CategorizationRuleInput): void {
    try {
      assertValidPattern(input.operator, input.pattern)
    } catch {
      throw new BadRequestException('Regulärer Ausdruck ist ungültig')
    }
    this.get(input.categoryId)
  }
}
