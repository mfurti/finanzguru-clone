import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  type InstrumentDto,
  type InstrumentInput,
  isValidIsin,
  type PricesInput,
} from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, price, transaction } from '../../database/schema'
import { RecomputeService } from '../import/recompute.service'

type Row = typeof instrument.$inferSelect

export function toInstrumentDto(row: Row): InstrumentDto {
  return {
    id: row.id,
    isin: row.isin,
    wkn: row.wkn,
    name: row.name,
    assetClass: row.assetClass,
    currency: row.currency,
  }
}

/** Instruments without positions (benchmarks, watchlists) and manual prices. */
@Injectable()
export class InstrumentsService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly recompute: RecomputeService,
  ) {}

  create(input: InstrumentInput): InstrumentDto {
    if (!isValidIsin(input.isin)) throw new BadRequestException('Ungültige ISIN')
    if (
      this.db
        .select({ id: instrument.id })
        .from(instrument)
        .where(eq(instrument.isin, input.isin))
        .get()
    ) {
      throw new ConflictException('Wertpapier existiert bereits')
    }
    const fund = input.assetClass === 'etf' || input.assetClass === 'fund'
    return toInstrumentDto(
      this.db
        .insert(instrument)
        .values({
          isin: input.isin,
          name: input.name,
          assetClass: input.assetClass,
          isBenchmark: input.isBenchmark,
          fundType: fund ? 'equity' : null,
        })
        .returning()
        .get(),
    )
  }

  /** Finds an instrument by ISIN or creates it (watchlists). */
  findOrCreate(isin: string, name: string): Row {
    if (!isValidIsin(isin)) throw new BadRequestException('Ungültige ISIN')
    const existing = this.db.select().from(instrument).where(eq(instrument.isin, isin)).get()
    if (existing) return existing
    return this.db
      .insert(instrument)
      .values({ isin, name, assetClass: 'etf', fundType: 'equity' })
      .returning()
      .get()
  }

  get(id: string): Row {
    const row = this.db.select().from(instrument).where(eq(instrument.id, id)).get()
    if (!row) throw new NotFoundException('Wertpapier nicht gefunden')
    return row
  }

  /** Upserts manual prices and recomputes snapshots of depots holding the instrument. */
  addPrices(id: string, input: PricesInput): { stored: number } {
    this.get(id)
    const rows = [...new Map(input.prices.map((p) => [p.date, p])).values()]
    this.db.transaction((tx) => {
      for (const row of rows) {
        tx.insert(price)
          .values({ instrumentId: id, date: row.date, close: row.close, source: 'manual' })
          .onConflictDoUpdate({
            target: [price.instrumentId, price.date],
            set: { close: row.close, source: 'manual' },
          })
          .run()
      }
      const from = rows.reduce((min, row) => (row.date < min ? row.date : min), rows[0]!.date)
      this.recomputeHolders(tx, id, from)
    })
    return { stored: rows.length }
  }

  recomputeHolders(
    db: Pick<AppDatabase, 'select' | 'selectDistinct' | 'insert' | 'delete'>,
    instrumentId: string,
    from?: string,
  ): void {
    const accounts = db
      .selectDistinct({ accountId: transaction.accountId })
      .from(transaction)
      .where(eq(transaction.instrumentId, instrumentId))
      .all()
      .map((row) => row.accountId)
    this.recompute.recompute(db, accounts, from)
  }
}
