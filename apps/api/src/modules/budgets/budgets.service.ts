import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { BudgetDto, BudgetInput } from '@finance/shared'
import { and, eq, gte, inArray, lt, lte, or } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, budget, category, transaction } from '../../database/schema'
import { periodBounds, todayIso } from '../../domain/period'

@Injectable()
export class BudgetsService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  list(today = todayIso()): BudgetDto[] {
    const month = periodBounds('month', today)
    const rows = this.db
      .select({
        id: budget.id,
        categoryId: budget.categoryId,
        monthlyLimitCents: budget.monthlyLimitCents,
        categoryName: category.name,
        color: category.color,
      })
      .from(budget)
      .innerJoin(category, eq(category.id, budget.categoryId))
      .all()
    return rows.map((row) => {
      const spentCents = this.spent(row.categoryId, month.from, month.to)
      return { ...row, spentCents, remainingCents: row.monthlyLimitCents - spentCents }
    })
  }

  create(input: BudgetInput): BudgetDto {
    this.assertExpenseCategory(input.categoryId)
    if (
      this.db
        .select({ id: budget.id })
        .from(budget)
        .where(eq(budget.categoryId, input.categoryId))
        .get()
    ) {
      throw new ConflictException('Für diese Kategorie gibt es bereits ein Budget')
    }
    const row = this.db.insert(budget).values(input).returning().get()
    return this.list().find((item) => item.id === row.id)!
  }

  update(id: string, input: Partial<BudgetInput>): BudgetDto {
    if (!this.db.select({ id: budget.id }).from(budget).where(eq(budget.id, id)).get()) {
      throw new NotFoundException('Budget nicht gefunden')
    }
    if (input.categoryId) this.assertExpenseCategory(input.categoryId)
    try {
      this.db.update(budget).set(input).where(eq(budget.id, id)).run()
    } catch {
      throw new ConflictException('Für diese Kategorie gibt es bereits ein Budget')
    }
    return this.list().find((item) => item.id === id)!
  }

  remove(id: string): void {
    if (this.db.delete(budget).where(eq(budget.id, id)).run().changes === 0) {
      throw new NotFoundException('Budget nicht gefunden')
    }
  }

  /** Outflows of the category (and its sub categories) on cash accounts in [from, to]. */
  private spent(categoryId: string, from: string, to: string): number {
    const subIds = this.db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.parentId, categoryId))
      .all()
      .map((row) => row.id)
    const ids = [categoryId, ...subIds]
    const rows = this.db
      .select({ amount: transaction.amountCents })
      .from(transaction)
      .innerJoin(account, eq(account.id, transaction.accountId))
      .where(
        and(
          inArray(transaction.categoryId, ids),
          gte(transaction.bookingDate, from),
          lte(transaction.bookingDate, to),
          lt(transaction.amountCents, 0),
          or(
            eq(transaction.type, 'expense'),
            eq(transaction.type, 'fee'),
            eq(transaction.type, 'tax'),
          ),
        ),
      )
      .all()
    return rows.reduce((sum, row) => sum - row.amount, 0)
  }

  private assertExpenseCategory(categoryId: string): void {
    const row = this.db
      .select({ kind: category.kind })
      .from(category)
      .where(eq(category.id, categoryId))
      .get()
    if (!row) throw new BadRequestException('Kategorie nicht gefunden')
    if (row.kind !== 'expense' && row.kind !== 'savings') {
      throw new BadRequestException('Budgets gibt es nur für Ausgabenkategorien')
    }
  }
}
