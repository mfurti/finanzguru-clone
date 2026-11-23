import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { InsuranceDto, InsuranceInput, PremiumInterval } from '@finance/shared'
import { asc, eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { category, insuranceContract } from '../../database/schema'

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
}
