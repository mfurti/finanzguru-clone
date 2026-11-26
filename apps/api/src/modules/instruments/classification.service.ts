import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { type ClassificationDto, WEIGHT_DIMENSIONS, type WeightDimension } from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { instrument, instrumentWeight } from '../../database/schema'
import { D } from '../../domain/money'
import { InstrumentsService } from './instruments.service'

const DIMENSION_NAMES: Record<WeightDimension, string> = {
  region: 'Regionen',
  sector: 'Branchen',
  currency: 'Währungen',
}

/** Region/sector/currency weights, fund type and benchmark flag per instrument (US1). */
@Injectable()
export class ClassificationService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly instruments: InstrumentsService,
  ) {}

  get(instrumentId: string): ClassificationDto {
    const row = this.instruments.get(instrumentId)
    const weights = this.db
      .select()
      .from(instrumentWeight)
      .where(eq(instrumentWeight.instrumentId, instrumentId))
      .all()
    const byDimension = (dimension: WeightDimension) =>
      weights
        .filter((w) => w.dimension === dimension)
        .map((w) => ({ key: w.key, weight: w.weight }))
        .sort((a, b) => Number(b.weight) - Number(a.weight))
    return {
      fundType: row.fundType,
      isBenchmark: row.isBenchmark,
      weights: {
        region: byDimension('region'),
        sector: byDimension('sector'),
        currency: byDimension('currency'),
      } as ClassificationDto['weights'],
    }
  }

  /** Replaces all weights; rejects a dimension whose weights sum to more than 100 %. */
  set(instrumentId: string, input: ClassificationDto): ClassificationDto {
    this.instruments.get(instrumentId)
    for (const dimension of WEIGHT_DIMENSIONS) {
      const total = input.weights[dimension].reduce((sum, w) => sum.plus(w.weight), new D(0))
      if (total.gt(1)) {
        const pct = total.times(100).toDecimalPlaces(2).toString().replace('.', ',')
        throw new BadRequestException(
          `${DIMENSION_NAMES[dimension]}: Summe ${pct} % – höchstens 100 %`,
        )
      }
    }
    this.db.transaction((tx) => {
      tx.delete(instrumentWeight).where(eq(instrumentWeight.instrumentId, instrumentId)).run()
      const rows = WEIGHT_DIMENSIONS.flatMap((dimension) =>
        input.weights[dimension].map((w) => ({
          instrumentId,
          dimension,
          key: w.key,
          weight: new D(w.weight).toString(),
        })),
      )
      if (rows.length > 0) tx.insert(instrumentWeight).values(rows).run()
      tx.update(instrument)
        .set({ fundType: input.fundType, isBenchmark: input.isBenchmark })
        .where(eq(instrument.id, instrumentId))
        .run()
    })
    return this.get(instrumentId)
  }
}
