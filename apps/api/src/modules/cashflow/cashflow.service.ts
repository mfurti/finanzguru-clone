import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CategoryDetail,
  CashflowCategories,
  CashflowQuery,
  CashflowSummary,
  SankeyResponse,
} from '@finance/shared'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { category, transaction } from '../../database/schema'
import {
  bars,
  type CashflowTx,
  type CategoryInfo,
  categoryTotals,
  sankey,
  totals,
} from '../../domain/cashflow'
import { lastPeriods, periodBounds, todayIso } from '../../domain/period'
import { OverviewService } from '../overview/overview.service'

@Injectable()
export class CashflowService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly overview: OverviewService,
  ) {}

  categories(): Map<string, CategoryInfo> {
    return new Map(
      this.db
        .select()
        .from(category)
        .all()
        .map((row) => [row.id, row as CategoryInfo]),
    )
  }

  /** Selected (or all visible) cash accounts — depots are not part of the budget. */
  cashAccountIds(accounts?: readonly string[]): string[] {
    return this.overview
      .resolveAccounts(accounts)
      .filter((acc) => acc.type !== 'depot')
      .map((acc) => acc.id)
  }

  private load(accountIds: string[], from: string, to: string): CashflowTx[] {
    if (accountIds.length === 0) return []
    return this.db
      .select({
        bookingDate: transaction.bookingDate,
        amountCents: transaction.amountCents,
        type: transaction.type,
        categoryId: transaction.categoryId,
      })
      .from(transaction)
      .where(
        and(
          inArray(transaction.accountId, accountIds),
          gte(transaction.bookingDate, from),
          lte(transaction.bookingDate, to),
        ),
      )
      .all()
  }

  summary(query: CashflowQuery, today = todayIso()): CashflowSummary {
    const anchor = query.anchor ?? today
    const period = periodBounds(query.granularity, anchor)
    const span = lastPeriods(query.granularity, anchor, 12)
    const categories = this.categories()
    const txs = this.load(this.cashAccountIds(query.accounts), span[0]!.from, period.to)
    const inPeriod = txs.filter(
      (tx) => tx.bookingDate >= period.from && tx.bookingDate <= period.to,
    )
    return {
      period,
      ...totals(inPeriod, categories),
      bars: bars(txs, categories, query.granularity, anchor, today),
    }
  }

  sankey(query: CashflowQuery, today = todayIso()): SankeyResponse {
    const period = periodBounds(query.granularity, query.anchor ?? today)
    return sankey(
      this.load(this.cashAccountIds(query.accounts), period.from, period.to),
      this.categories(),
    )
  }

  categoryList(
    query: CashflowQuery & { kind: 'expense' | 'income' },
    today = todayIso(),
  ): CashflowCategories {
    const period = periodBounds(query.granularity, query.anchor ?? today)
    return categoryTotals(
      this.load(this.cashAccountIds(query.accounts), period.from, period.to),
      this.categories(),
      query.kind,
    )
  }

  /**
   * Category detail (003 US3, FR-021): total in the period and the last 12
   * months, sub categories included. Expense totals are shown positive.
   */
  categoryDetail(id: string, query: CashflowQuery, today = todayIso()): CategoryDetail {
    const categories = this.categories()
    const main = categories.get(id)
    if (!main) throw new NotFoundException('Kategorie nicht gefunden')
    const ids = new Set([
      id,
      ...[...categories.values()].filter((c) => c.parentId === id).map((c) => c.id),
    ])
    const anchor = query.anchor ?? today
    const period = periodBounds(query.granularity, anchor)
    const months = lastPeriods('month', anchor, 12)
    const from = months[0]!.from < period.from ? months[0]!.from : period.from
    const to = months.at(-1)!.to > period.to ? months.at(-1)!.to : period.to
    const txs = this.load(this.cashAccountIds(query.accounts), from, to).filter(
      (tx) => tx.categoryId && ids.has(tx.categoryId),
    )
    const sign = main.kind === 'income' ? 1 : -1
    const sumIn = (a: string, b: string) =>
      sign *
      txs
        .filter((tx) => tx.bookingDate >= a && tx.bookingDate <= b)
        .reduce((sum, tx) => sum + tx.amountCents, 0)
    const row = this.db.select().from(category).where(eq(category.id, id)).get()!
    return {
      id,
      name: row.name,
      kind: row.kind,
      color: row.color,
      icon: row.icon,
      parentId: row.parentId,
      totalCents: sumIn(period.from, period.to),
      history: months.map((month) => ({
        month: month.from.slice(0, 7),
        cents: sumIn(month.from, month.to),
      })),
    }
  }
}
