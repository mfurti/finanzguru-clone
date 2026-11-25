import { describe, expect, it } from 'vitest'
import { classSeries, type ClassDayRow } from '../../src/domain/class-performance'

const row = (
  date: string,
  assetClass: ClassDayRow['assetClass'],
  valueCents: number,
  flowCents = 0,
): ClassDayRow => ({ date, assetClass, valueCents, flowCents })

describe('class performance (005 T017, research R5)', () => {
  // Stock: bought 1000 on day 2, worth 1100 on day 3, sold for 900 on day 4.
  // ETF: held all days, 2000 → 2100 → 2100 → 2205.
  const rows = [
    row('2026-01-01', 'etf', 200000),
    row('2026-01-02', 'etf', 210000),
    row('2026-01-02', 'stock', 100000, 100000),
    row('2026-01-03', 'etf', 210000),
    row('2026-01-03', 'stock', 110000),
    row('2026-01-04', 'etf', 220500),
    row('2026-01-04', 'stock', 0, -90000),
    row('2026-01-05', 'etf', 220500),
  ]
  const { classes, series } = classSeries(rows, '2026-01-01', '2026-01-05')
  const stock = series.map((day) => day.byClass.stock!)
  const etf = series.map((day) => day.byClass.etf!)

  it('lists only classes held in the range', () => {
    expect(classes).toEqual(['etf', 'stock'])
    expect(classSeries(rows, '2026-01-05', '2026-01-05').classes).toEqual(['etf'])
    expect(classSeries(rows, '2026-02-01', '2026-02-02').classes).toEqual([])
  })

  it('shows the class value in €, 0 after the sale', () => {
    expect(stock.map((point) => point.valueCents)).toEqual([0, 100000, 110000, 0, 0])
  })

  it('does not count the buy as gain and stays flat after the sale', () => {
    expect(stock.map((point) => point.twrorPct)).toEqual([
      null,
      '0.000000',
      '0.100000',
      '-0.100000',
      '-0.100000',
    ])
  })

  it('keeps classes independent', () => {
    expect(etf.map((point) => point.twrorPct)).toEqual([
      '0.000000',
      '0.050000',
      '0.050000',
      '0.102500',
      '0.102500',
    ])
  })

  it('adds the class values up to the "Alle" line', () => {
    for (const day of series) {
      const sum = Object.values(day.byClass).reduce((acc, point) => acc + point.valueCents, 0)
      expect(day.total.valueCents).toBe(sum)
    }
    expect(series[1]!.total.twrorPct).toBe('0.050000')
  })
})
