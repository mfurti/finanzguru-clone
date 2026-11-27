import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  InsuranceDto,
  InsuranceInput,
  InsuranceSuggestionDto,
  PremiumInterval,
} from '@finance/shared'
import { and, asc, eq, gte, inArray, lt, or } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  category,
  insuranceContract,
  insuranceSuggestionDismissal,
  transaction,
} from '../../database/schema'
import { detectInsuranceSuggestions } from '../../domain/insurance-suggestions'
import { addMonths, todayIso } from '../../domain/period'

const PAYMENTS_PER_YEAR: Record<PremiumInterval, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
}

type Row = typeof insuranceContract.$inferSelect

export function toDto(row: Row): InsuranceDto {
  return {
    id: row.id,
    type: row.type,
    provider: row.provider,
    contractNumber: row.contractNumber,
    premiumCents: row.premiumCents,
    interval: row.interval,
    startDate: row.startDate,
    endDate: row.endDate,
    notes: row.notes,
    linkedCategoryId: row.linkedCategoryId,
    yearlyCostCents: row.premiumCents * PAYMENTS_PER_YEAR[row.interval],
  }
}

@Injectable()
export class InsuranceService {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  list(): InsuranceDto[] {
    return this.db
      .select()
      .from(insuranceContract)
      .orderBy(asc(insuranceContract.type), asc(insuranceContract.provider))
      .all()
      .map(toDto)
  }

  create(input: InsuranceInput): InsuranceDto {
    this.checkCategory(input.linkedCategoryId)
    return toDto(this.db.insert(insuranceContract).values(this.values(input)).returning().get())
  }

  update(id: string, input: InsuranceInput): InsuranceDto {
    this.checkCategory(input.linkedCategoryId)
    const row = this.db
      .update(insuranceContract)
      .set(this.values(input))
      .where(eq(insuranceContract.id, id))
      .returning()
      .get()
    if (!row) throw new NotFoundException('Vertrag nicht gefunden')
    return toDto(row)
  }

  remove(id: string): void {
    if (this.db.delete(insuranceContract).where(eq(insuranceContract.id, id)).run().changes === 0) {
      throw new NotFoundException('Vertrag nicht gefunden')
    }
  }

  private values(input: InsuranceInput) {
    return {
      type: input.type,
      provider: input.provider,
      contractNumber: input.contractNumber ?? null,
      premiumCents: input.premiumCents,
      interval: input.interval,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      notes: input.notes ?? null,
      linkedCategoryId: input.linkedCategoryId ?? null,
    }
  }

  private checkCategory(id: string | null | undefined): void {
    if (
      id &&
      !this.db.select({ id: category.id }).from(category).where(eq(category.id, id)).get()
    ) {
      throw new BadRequestException('Kategorie nicht gefunden')
    }
  }

  /**
   * Contracts suggested from recurring outgoing bookings of the last 18 months in the main
   * category "Versicherung" and its sub categories (012 P14).
   */
  suggestions(today = todayIso()): InsuranceSuggestionDto[] {
    const main = this.db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.name, 'Versicherung'))
      .get()
    if (!main) return []
    const categories = this.db
      .select({ id: category.id, name: category.name })
      .from(category)
      .where(or(eq(category.id, main.id), eq(category.parentId, main.id)))
      .all()
    const names = new Map(categories.map((row) => [row.id, row.name]))
    const bookings = this.db
      .select({
        date: transaction.bookingDate,
        amountCents: transaction.amountCents,
        counterparty: transaction.counterparty,
        categoryId: transaction.categoryId,
      })
      .from(transaction)
      .where(
        and(
          inArray(transaction.categoryId, [...names.keys()]),
          lt(transaction.amountCents, 0),
          gte(transaction.bookingDate, addMonths(today, -18)),
        ),
      )
      .all()
      .map((row) => ({ ...row, categoryName: names.get(row.categoryId ?? '') ?? null }))
    const providers = this.db
      .select({ provider: insuranceContract.provider })
      .from(insuranceContract)
      .all()
      .map((row) => row.provider)
    const dismissed = new Set(
      this.db
        .select({ key: insuranceSuggestionDismissal.key })
        .from(insuranceSuggestionDismissal)
        .all()
        .map((row) => row.key),
    )
    return detectInsuranceSuggestions(bookings, providers, dismissed)
  }

  dismissSuggestion(key: string): void {
    if (key.length < 1 || key.length > 200) throw new BadRequestException('Ungültiger Vorschlag')
    this.db.insert(insuranceSuggestionDismissal).values({ key }).onConflictDoNothing().run()
  }
}
