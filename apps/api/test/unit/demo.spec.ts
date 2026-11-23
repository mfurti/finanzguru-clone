import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { DEMO_END, seedDemo, DEMO_INSTRUMENTS } from '../../src/database/demo'
import { isValidIsin } from '@finance/shared'
import { createTestDb } from '../helpers/test-db'

const expected = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/demo-expected.json'), 'utf8'),
) as {
  totalCents: number
  depotValueCents: number
  depotInvestedCents: number
  cashCents: number
  transactions: number
  unreviewed: number
  openPositions: number
}

describe('demo dataset', () => {
  it('uses valid ISINs', () => {
    expect(DEMO_INSTRUMENTS.every((demo) => isValidIsin(demo.isin))).toBe(true)
  })

  it('is deterministic and matches demo-expected.json', () => {
    const db = createTestDb()
    const result = seedDemo(db, '2026-11-23')
    expect(result.transactions).toBe(expected.transactions)

    const latest = db.all<{ type: string; value: number; invested: number }>(sql`
      SELECT a.type AS type, s.value_cents AS value, s.invested_cents AS invested
      FROM net_worth_snapshot s JOIN account a ON a.id = s.account_id
      WHERE s.date = (SELECT max(date) FROM net_worth_snapshot x WHERE x.account_id = s.account_id)
    `)
    const sum = (rows: typeof latest, key: 'value' | 'invested') =>
      rows.reduce((total, row) => total + row[key], 0)
    const depot = latest.filter((row) => row.type === 'depot')
    expect(sum(latest, 'value')).toBe(expected.totalCents)
    expect(sum(depot, 'value')).toBe(expected.depotValueCents)
    expect(sum(depot, 'invested')).toBe(expected.depotInvestedCents)

    const unreviewed = db.get<{ c: number }>(
      sql`SELECT count(*) AS c FROM transactions WHERE review_status = 'unreviewed' AND category_id IS NULL`,
    )
    expect(unreviewed?.c).toBe(expected.unreviewed)
    const open = db.get<{ c: number }>(
      sql`SELECT count(DISTINCT instrument_id) AS c FROM position_lot`,
    )
    expect(open?.c).toBe(expected.openPositions)
  })

  it('ends its price history on DEMO_END and refuses to run twice', () => {
    const db = createTestDb()
    seedDemo(db, '2026-11-23')
    const last = db.get<{ d: string }>(sql`SELECT max(date) AS d FROM price`)
    expect(last?.d).toBe(DEMO_END)
    expect(() => seedDemo(db, '2026-11-23')).toThrow(/already present/)
  })
})
