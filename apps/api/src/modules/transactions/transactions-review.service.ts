import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  TransactionListItem,
  TransactionListQuery,
  UpdateTransactionInput,
} from '@finance/shared'
import { and, count, desc, eq, gte, inArray, isNull, like, lte, max, or } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, categorizationRule, category, transaction } from '../../database/schema'
import { assertValidPattern, matchesRule, type Rule } from '../../domain/categorize'
import { OverviewService } from '../overview/overview.service'

@Injectable()
export class TransactionsReviewService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  list(query: TransactionListQuery): { items: TransactionListItem[]; total: number } {
    const ids = this.overview.resolveAccounts(query.accounts).map((acc) => acc.id)
    if (ids.length === 0) return { items: [], total: 0 }
    const search = query.q ? `%${query.q.replace(/[%_]/g, '')}%` : undefined
    const where = and(
      inArray(transaction.accountId, ids),
      query.categoryId === 'uncategorized'
        ? isNull(transaction.categoryId)
        : query.categoryId
          ? or(
              eq(transaction.categoryId, query.categoryId),
              eq(category.parentId, query.categoryId),
            )
          : undefined,
      query.status ? eq(transaction.reviewStatus, query.status) : undefined,
      query.type ? eq(transaction.type, query.type) : undefined,
      query.from ? gte(transaction.bookingDate, query.from) : undefined,
      query.to ? lte(transaction.bookingDate, query.to) : undefined,
      search
        ? or(like(transaction.counterparty, search), like(transaction.purpose, search))
        : undefined,
    )
    const total =
      this.db
        .select({ n: count() })
        .from(transaction)
        .leftJoin(category, eq(category.id, transaction.categoryId))
        .where(where)
        .get()?.n ?? 0
    const items = this.db
      .select({
        id: transaction.id,
        accountId: transaction.accountId,
        accountName: account.name,
        bookingDate: transaction.bookingDate,
        amountCents: transaction.amountCents,
        type: transaction.type,
        counterparty: transaction.counterparty,
        purpose: transaction.purpose,
        categoryId: transaction.categoryId,
        categoryName: category.name,
        categorySource: transaction.categorySource,
        reviewStatus: transaction.reviewStatus,
      })
      .from(transaction)
      .innerJoin(account, eq(account.id, transaction.accountId))
      .leftJoin(category, eq(category.id, transaction.categoryId))
      .where(where)
      .orderBy(desc(transaction.bookingDate), desc(transaction.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .all()
    return { items, total }
  }

  /**
   * Categorize / review one transaction. Setting a category marks it reviewed and
   * manual. `createRule` also stores a rule and applies it to other unreviewed,
   * uncategorized bookings (SC-005).
   */
  update(id: string, input: UpdateTransactionInput): { updated: number } {
    const row = this.db.select().from(transaction).where(eq(transaction.id, id)).get()
    if (!row) throw new NotFoundException('Transaktion nicht gefunden')
    if (
      input.categoryId &&
      !this.db
        .select({ id: category.id })
        .from(category)
        .where(eq(category.id, input.categoryId))
        .get()
    ) {
      throw new BadRequestException('Kategorie nicht gefunden')
    }
    if (input.createRule) {
      if (!input.categoryId)
        throw new BadRequestException('Für eine Regel wird eine Kategorie benötigt')
      try {
        assertValidPattern(input.createRule.operator, input.createRule.pattern)
      } catch {
        throw new BadRequestException('Regulärer Ausdruck ist ungültig')
      }
    }

    return this.db.transaction((tx) => {
      const categoryChanged = input.categoryId !== undefined
      tx.update(transaction)
        .set({
          ...(categoryChanged && {
            categoryId: input.categoryId,
            categorySource: input.categoryId ? 'manual' : null,
          }),
          ...(input.type && { type: input.type }),
          reviewStatus: input.reviewStatus ?? (categoryChanged ? 'reviewed' : row.reviewStatus),
        })
        .where(eq(transaction.id, id))
        .run()

      let updated = 1
      if (input.createRule && input.categoryId) {
        const priority =
          (tx
            .select({ top: max(categorizationRule.priority) })
            .from(categorizationRule)
            .get()?.top ?? 0) + 1
        const rule = tx
          .insert(categorizationRule)
          .values({ ...input.createRule, categoryId: input.categoryId, priority })
          .returning()
          .get() as Rule
        const candidates = tx
          .select()
          .from(transaction)
          .where(and(eq(transaction.reviewStatus, 'unreviewed'), isNull(transaction.categoryId)))
          .all()
        for (const candidate of candidates) {
          if (!matchesRule(rule, candidate)) continue
          tx.update(transaction)
            .set({ categoryId: input.categoryId, categorySource: 'rule' })
            .where(eq(transaction.id, candidate.id))
            .run()
          updated++
        }
      }
      return { updated }
    })
  }
}
