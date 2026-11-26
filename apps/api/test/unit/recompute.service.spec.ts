import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  account,
  institution,
  instrument,
  netWorthSnapshot,
  positionLot,
  price,
  transaction,
} from '../../src/database/schema'
import { RecomputeService } from '../../src/modules/import/recompute.service'
import { createTestDb } from '../helpers/test-db'

describe('RecomputeService', () => {
  let db: AppDatabase
  let depotId: string
  let giroId: string
  let etfId: string
  const service = new RecomputeService()

  beforeEach(() => {
    db = createTestDb()
    const inst = db.insert(institution).values({ name: 'Bank' }).returning().get().id
    depotId = db
      .insert(account)
      .values({ institutionId: inst, name: 'Depot', type: 'depot' })
      .returning()
      .get().id
    giroId = db
      .insert(account)
      .values({ institutionId: inst, name: 'Giro', type: 'checking', balanceCents: 50000 })
      .returning()
      .get().id
    etfId = db
      .insert(instrument)
      .values({ isin: 'IE00B4L5Y983', name: 'MSCI World', assetClass: 'etf' })
      .returning()
      .get().id
    db.insert(price)
      .values([
        { instrumentId: etfId, date: '2026-11-02', close: '100', source: 'csv' },
        { instrumentId: etfId, date: '2026-11-04', close: '110', source: 'csv' },
      ])
      .run()
    db.insert(transaction)
      .values([
        {
          accountId: depotId,
          bookingDate: '2026-11-02',
          amountCents: -50000,
          type: 'buy',
          instrumentId: etfId,
          quantity: '5',
          unitPrice: '100',
          source: 'manual',
          fingerprint: 'b1',
        },
        {
          accountId: giroId,
          bookingDate: '2026-11-03',
          amountCents: -2000,
          type: 'expense',
          source: 'manual',
          fingerprint: 'g1',
        },
      ])
      .run()
  })

  it('writes daily snapshots and open lots', () => {
    service.recompute(db, [depotId, giroId], undefined, '2026-11-05')

    const depotRows = db
      .select()
      .from(netWorthSnapshot)
      .where(eq(netWorthSnapshot.accountId, depotId))
      .all()
    expect(depotRows.map((row) => [row.date, row.valueCents])).toEqual([
      ['2026-11-02', 50000],
      ['2026-11-03', 50000],
      ['2026-11-04', 55000],
      ['2026-11-05', 55000],
    ])
    expect(depotRows[0]?.externalFlowCents).toBe(50000)

    const giroRows = db
      .select()
      .from(netWorthSnapshot)
      .where(eq(netWorthSnapshot.accountId, giroId))
      .all()
    expect(giroRows.map((row) => row.valueCents)).toEqual([50000, 50000, 50000])

    const lots = db.select().from(positionLot).all()
    expect(lots).toHaveLength(1)
    expect(lots[0]).toMatchObject({ quantityOpen: '5', costPerUnit: '100' })
  })

  it('is idempotent and rebuilds only from the given date', () => {
    service.recompute(db, [depotId], undefined, '2026-11-05')
    service.recompute(db, [depotId], '2026-11-04', '2026-11-05')
    const rows = db.select().from(netWorthSnapshot).all()
    expect(rows).toHaveLength(4)
    expect(db.select().from(positionLot).all()).toHaveLength(1)
  })

  it('runs inside a caller transaction and rolls back with it', () => {
    expect(() =>
      db.transaction((tx) => {
        service.recompute(tx, [depotId], undefined, '2026-11-05')
        throw new Error('abort import')
      }),
    ).toThrow('abort import')
    expect(db.select().from(netWorthSnapshot).all()).toHaveLength(0)
  })
})
