import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  TransactionFilter,
  TransactionListQuery,
  TransactionPage,
  TransactionSort,
  TransactionType,
  UpdateTransactionInput,
  CategorizeResult,
} from '@finance/shared'
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  or,
  type SQL,
  sql,
  sum,
} from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  category,
  institution,
  tag,
  transaction,
  transactionTag,
} from '../../database/schema'
import { assertValidPattern, counterpartyKey, wouldChange } from '../../domain/categorize'
import { appendRule, applyRule } from './rule-apply'
import { recordManualCategorization } from './rule-suggestion-store'
import { OverviewService } from '../overview/overview.service'

@Injectable()
export class TransactionsReviewService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  /**
   * WHERE clause for the transactions table (R1). Shared by list, export and
   * bulk actions so a bulk "filter" hits exactly the rows the table shows.
   * Needs a LEFT JOIN on `category` (parent match for category filters).
   * Returns undefined when no visible account matches (empty result).
   */
  whereFor(filter: TransactionFilter): SQL | undefined | null {
    const ids = this.overview.resolveAccounts(filter.accounts).map((acc) => acc.id)
    if (ids.length === 0) return null
    const search = filter.q ? `%${filter.q.replace(/[%_]/g, '')}%` : undefined
    const categoryIds = [
      ...(filter.categoryIds ?? []),
      ...(filter.categoryId ? [filter.categoryId] : []),
    ]
    const realCategoryIds = categoryIds.filter((id) => id !== 'uncategorized')
    // "Ungeprüft" as in 001: not reviewed and without category; rule-categorized rows count as done.
    const open = and(eq(transaction.reviewStatus, 'unreviewed'), isNull(transaction.categoryId))
    const review =
      filter.review === 'unreviewed' ? open : filter.review === 'reviewed' ? not(open!) : undefined
    const types = [...(filter.types ?? []), ...(filter.type ? [filter.type] : [])]
    return and(
      inArray(transaction.accountId, ids),
      categoryIds.length > 0
        ? or(
            categoryIds.includes('uncategorized') ? isNull(transaction.categoryId) : undefined,
            realCategoryIds.length > 0
              ? or(
                  inArray(transaction.categoryId, realCategoryIds),
                  inArray(category.parentId, realCategoryIds),
                )
              : undefined,
          )
        : undefined,
      filter.tagIds && filter.tagIds.length > 0
        ? exists(
            this.db
              .select({ one: sql`1` })
              .from(transactionTag)
              .where(
                and(
                  eq(transactionTag.transactionId, transaction.id),
                  inArray(transactionTag.tagId, filter.tagIds),
                ),
              ),
          )
        : undefined,
      review,
      filter.status ? eq(transaction.reviewStatus, filter.status) : undefined,
      types.length > 0 ? inArray(transaction.type, types as TransactionType[]) : undefined,
      filter.from ? gte(transaction.bookingDate, filter.from) : undefined,
      filter.to ? lte(transaction.bookingDate, filter.to) : undefined,
      filter.minCents !== undefined ? gte(transaction.amountCents, filter.minCents) : undefined,
      filter.maxCents !== undefined ? lte(transaction.amountCents, filter.maxCents) : undefined,
      // Kontobewegungen (007): incoming or outgoing only.
      filter.direction === 'in' ? gt(transaction.amountCents, 0) : undefined,
      filter.direction === 'out' ? lt(transaction.amountCents, 0) : undefined,
      search
        ? or(like(transaction.counterparty, search), like(transaction.purpose, search))
        : undefined,
    )
  }

  /** ORDER BY for a sort key; ties broken by id so paging is stable. */
  orderFor(sort: TransactionSort, dir: 'asc' | 'desc'): SQL[] {
    const by = dir === 'asc' ? asc : desc
    const column = {
      date: transaction.bookingDate,
      amount: transaction.amountCents,
      counterparty: sql`lower(coalesce(${transaction.counterparty}, ''))`,
      category: sql`lower(coalesce(${category.name}, ''))`,
      account: sql`lower(${account.name})`,
    }[sort]
    return [by(column), by(transaction.createdAt), by(transaction.id)]
  }

  list(query: TransactionListQuery): TransactionPage {
    const empty = { items: [], total: 0, page: query.page, pageSize: query.pageSize, sumCents: 0 }
    const where = this.whereFor(query)
    if (where === null) return empty
    const totals = this.db
      .select({ n: count(), sum: sum(transaction.amountCents) })
      .from(transaction)
      .leftJoin(category, eq(category.id, transaction.categoryId))
      .where(where)
      .get()
    const rows = this.db
      .select({
        id: transaction.id,
        accountId: transaction.accountId,
        accountName: account.name,
        institutionName: institution.name,
        bookingDate: transaction.bookingDate,
        amountCents: transaction.amountCents,
        type: transaction.type,
        counterparty: transaction.counterparty,
        counterpartyIban: transaction.counterpartyIban,
        purpose: transaction.purpose,
        note: transaction.note,
        categoryId: transaction.categoryId,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        categorySource: transaction.categorySource,
        reviewStatus: transaction.reviewStatus,
      })
      .from(transaction)
      .innerJoin(account, eq(account.id, transaction.accountId))
      .leftJoin(institution, eq(institution.id, account.institutionId))
      .leftJoin(category, eq(category.id, transaction.categoryId))
      .where(where)
      .orderBy(...this.orderFor(query.sort, query.dir))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
      .all()
    const tags = this.tagsOf(rows.map((row) => row.id))
    return {
      items: rows.map((row) => ({
        ...row,
        tags: tags.get(row.id) ?? [],
        // Logos follow in 008 T007.
        logo: null,
        logoSource: null,
        recipientKey: null,
      })),
      total: totals?.n ?? 0,
      page: query.page,
      pageSize: query.pageSize,
      sumCents: Number(totals?.sum ?? 0),
    }
  }

  /** Tags per transaction id, one query for the whole page (no N+1). */
  tagsOf(ids: readonly string[]): Map<string, { id: string; name: string; color: string }[]> {
    const result = new Map<string, { id: string; name: string; color: string }[]>()
    if (ids.length === 0) return result
    const rows = this.db
      .select({
        transactionId: transactionTag.transactionId,
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })
      .from(transactionTag)
      .innerJoin(tag, eq(tag.id, transactionTag.tagId))
      .where(inArray(transactionTag.transactionId, [...ids]))
      .orderBy(asc(tag.name))
      .all()
    for (const { transactionId, ...item } of rows) {
      result.set(transactionId, [...(result.get(transactionId) ?? []), item])
    }
    return result
  }

  /**
   * Categorize / review one transaction. Setting a category marks it reviewed and manual.
   * `scope: 'recipient'` also sets it on the other bookings of the same recipient (006 US1);
   * `createRule` saves a rule and applies it (001 T069, restored in 006). Manual bookings,
   * transfers and trades of other rows are never changed (FR-008).
   */
  update(id: string, input: UpdateTransactionInput): CategorizeResult {
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
    const recipient = counterpartyKey(row)
    if (input.scope === 'recipient') {
      if (!input.categoryId) {
        throw new BadRequestException('Für alle Buchungen wird eine Kategorie benötigt')
      }
      if (!recipient) throw new BadRequestException('Die Buchung hat keinen Empfänger')
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
          ...(input.note !== undefined && { note: input.note }),
          reviewStatus: input.reviewStatus ?? (categoryChanged ? 'reviewed' : row.reviewStatus),
        })
        .where(eq(transaction.id, id))
        .run()

      if (input.tagIds) {
        const known = input.tagIds.length
          ? tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, input.tagIds)).all()
          : []
        if (known.length !== new Set(input.tagIds).size) {
          throw new BadRequestException('Tag nicht gefunden')
        }
        tx.delete(transactionTag).where(eq(transactionTag.transactionId, id)).run()
        if (known.length > 0) {
          tx.insert(transactionTag)
            .values(known.map((item) => ({ transactionId: id, tagId: item.id })))
            .run()
        }
      }

      let updated = 1
      if (input.scope === 'recipient' && input.categoryId) {
        // The owner decided for the whole recipient: these become manual, like this booking.
        for (const other of tx.select().from(transaction).where(ne(transaction.id, id)).all()) {
          if (counterpartyKey(other) !== recipient || !wouldChange(other)) continue
          tx.update(transaction)
            .set({
              categoryId: input.categoryId,
              categorySource: 'manual',
              reviewStatus: 'reviewed',
            })
            .where(eq(transaction.id, other.id))
            .run()
          updated++
        }
      }

      let ruleId: string | null = null
      let ruleApplied = 0
      if (input.createRule && input.categoryId) {
        const rule = appendRule(tx, input.createRule, input.categoryId)
        ruleId = rule.id
        ruleApplied = applyRule(tx, rule)
      }
      // Count the manual choice for "Regel anlegen?" (006 US2); only for this booking alone.
      const suggestion =
        input.categoryId && recipient && input.scope !== 'recipient'
          ? recordManualCategorization(tx, recipient, input.categoryId, !!ruleId)
          : null
      return { updated, ruleId, ruleApplied, suggestion }
    })
  }
}
