import { beforeEach, describe, expect, it } from 'vitest'
import type { AppDatabase } from '../../src/database/drizzle.module'
import {
  account,
  category,
  institution,
  instrument,
  owner,
  price,
  transaction,
} from '../../src/database/schema'
import { createTestDb } from '../helpers/test-db'

describe('schema constraints', () => {
  let db: AppDatabase
  let institutionId: string
  let accountId: string

  beforeEach(() => {
    db = createTestDb()
    institutionId = db.insert(institution).values({ name: 'Manuell' }).returning().get().id
    accountId = db
      .insert(account)
      .values({ institutionId, name: 'Girokonto', type: 'checking' })
      .returning()
      .get().id
  })

  it('generates UUIDv7 ids', () => {
    expect(accountId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/)
  })

  it('allows only one owner row', () => {
    db.insert(owner).values({ displayName: 'Alex', passwordHash: 'h' }).run()
    expect(() =>
      db.insert(owner).values({ id: 'other', displayName: 'X', passwordHash: 'h' }).run(),
    ).toThrow(/owner_single_row/)
  })

  it('rejects an inflation rate above 0.5', () => {
    expect(() =>
      db
        .insert(owner)
        .values({ displayName: 'Alex', passwordHash: 'h', inflationRate: '0.6' })
        .run(),
    ).toThrow(/owner_inflation_range/)
  })

  it('rejects unknown account types and names longer than 80 chars', () => {
    expect(() =>
      db
        .insert(account)
        // @ts-expect-error invalid enum value on purpose
        .values({ institutionId, name: 'X', type: 'wallet' })
        .run(),
    ).toThrow(/account_type/)
    expect(() =>
      db
        .insert(account)
        .values({ institutionId, name: 'x'.repeat(81), type: 'cash' })
        .run(),
    ).toThrow(/account_name_len/)
  })

  it('keeps IBANs unique when set but allows several accounts without IBAN', () => {
    db.insert(account).values({ institutionId, name: 'A', type: 'cash' }).run()
    db.insert(account).values({ institutionId, name: 'B', type: 'cash' }).run()
    db.insert(account)
      .values({ institutionId, name: 'C', type: 'checking', iban: 'DE89370400440532013000' })
      .run()
    expect(() =>
      db
        .insert(account)
        .values({ institutionId, name: 'D', type: 'checking', iban: 'DE89370400440532013000' })
        .run(),
    ).toThrow(/UNIQUE/)
  })

  it('validates instrument ISIN length, WKN length and prices > 0', () => {
    const instrumentId = db
      .insert(instrument)
      .values({ isin: 'IE00B4L5Y983', wkn: 'A0RPWH', name: 'MSCI World', assetClass: 'etf' })
      .returning()
      .get().id
    expect(() =>
      db.insert(instrument).values({ isin: 'SHORT', name: 'X', assetClass: 'etf' }).run(),
    ).toThrow(/instrument_isin_len/)
    expect(() =>
      db
        .insert(price)
        .values({ instrumentId, date: '2026-11-20', close: '0', source: 'csv' })
        .run(),
    ).toThrow(/price_close_positive/)
  })

  it('keeps category names unique within the same parent, including top level', () => {
    db.insert(category).values({ name: 'Wohnen', kind: 'expense' }).run()
    expect(() => db.insert(category).values({ name: 'Wohnen', kind: 'expense' }).run()).toThrow(
      /UNIQUE/,
    )
  })

  it('requires instrument and quantity for buy transactions', () => {
    expect(() =>
      db
        .insert(transaction)
        .values({
          accountId,
          bookingDate: '2026-11-20',
          amountCents: -10000,
          type: 'buy',
          source: 'manual',
          fingerprint: 'fp-1',
        })
        .run(),
    ).toThrow(/transactions_instrument_required/)
  })

  it('defaults review status to unreviewed and fees/taxes to 0', () => {
    const row = db
      .insert(transaction)
      .values({
        accountId,
        bookingDate: '2026-11-20',
        amountCents: -4990,
        type: 'expense',
        source: 'manual',
        fingerprint: 'fp-2',
      })
      .returning()
      .get()
    expect(row.reviewStatus).toBe('unreviewed')
    expect(row.feeCents).toBe(0)
    expect(row.taxCents).toBe(0)
  })
})
