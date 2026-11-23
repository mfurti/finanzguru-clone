import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { type CreateTransactionInput, isValidIsin, type TransactionDto } from '@finance/shared'
import { eq, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, category, instrument, transaction } from '../../database/schema'
import { todayIso } from '../../domain/period'
import { RecomputeService } from '../import/recompute.service'

/** Manual transactions (FR-056). */
@Injectable()
export class TransactionsWriteService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly recompute: RecomputeService,
  ) {}

  create(input: CreateTransactionInput): TransactionDto {
    const acc = this.db.select().from(account).where(eq(account.id, input.accountId)).get()
    if (!acc) throw new NotFoundException('Konto nicht gefunden')
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
    const isin = input.isin?.toUpperCase()
    if (isin && !isValidIsin(isin)) throw new BadRequestException('ISIN ist ungültig')
    if (acc.type === 'depot' && ['income', 'expense'].includes(input.type)) {
      throw new BadRequestException('Depots nehmen nur Wertpapier-Buchungen auf')
    }

    const id = this.db.transaction((tx) => {
      let instrumentId: string | null = null
      if (isin) {
        instrumentId =
          tx.select({ id: instrument.id }).from(instrument).where(eq(instrument.isin, isin)).get()
            ?.id ??
          tx
            .insert(instrument)
            .values({ isin, name: isin, assetClass: 'other' })
            .returning({ id: instrument.id })
            .get().id
      }
      const row = tx
        .insert(transaction)
        .values({
          accountId: acc.id,
          bookingDate: input.bookingDate,
          valueDate: input.valueDate ?? null,
          amountCents: input.amountCents,
          type: input.type,
          counterparty: input.counterparty ?? null,
          counterpartyIban: input.counterpartyIban ?? null,
          purpose: input.purpose ?? null,
          instrumentId,
          quantity: input.quantity ?? null,
          unitPrice: input.unitPrice ?? null,
          feeCents: input.feeCents,
          taxCents: input.taxCents,
          categoryId: input.categoryId ?? null,
          categorySource: input.categoryId ? 'manual' : null,
          reviewStatus: input.categoryId ? 'reviewed' : 'unreviewed',
          source: 'manual',
          // Manual entries may legitimately repeat; each one gets its own fingerprint.
          fingerprint: `manual:${uuidv7()}`,
        })
        .returning({ id: transaction.id })
        .get()
      // A booked cash movement changes the account's current balance.
      if (acc.type !== 'depot' && input.bookingDate <= todayIso()) {
        tx.update(account)
          .set({ balanceCents: sql`${account.balanceCents} + ${input.amountCents}` })
          .where(eq(account.id, acc.id))
          .run()
      }
      this.recompute.recompute(tx, [acc.id], input.bookingDate)
      return row.id
    })
    return this.db
      .select()
      .from(transaction)
      .where(eq(transaction.id, id))
      .get() as unknown as TransactionDto
  }
}
