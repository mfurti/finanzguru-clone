import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type DatedCashFlow,
  periodCashFlows,
  realReturn,
  twror,
  type ValuePoint,
  xirr,
} from '../../src/domain/returns'

const reference = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/returns-reference.json'), 'utf8'),
) as {
  xirr: { name: string; flows: DatedCashFlow[]; expected: number }[]
  twror: { name: string; series: ValuePoint[]; expected: number }[]
}

/** SC-007: within 0.01 percentage points. */
const TOLERANCE = 0.0001

describe('XIRR against reference values', () => {
  for (const testCase of reference.xirr) {
    it(testCase.name, () => {
      const result = xirr(testCase.flows)
      expect(result).not.toBeNull()
      expect(Math.abs(Number(result) - testCase.expected)).toBeLessThan(TOLERANCE)
    })
  }

  it('returns null without a sign change', () => {
    expect(
      xirr([
        { date: '2025-01-01', amountCents: 100 },
        { date: '2026-01-01', amountCents: 100 },
      ]),
    ).toBeNull()
  })
})

describe('TWROR against reference values', () => {
  for (const testCase of reference.twror) {
    it(testCase.name, () => {
      const result = twror(testCase.series)
      expect(Math.abs(Number(result) - testCase.expected)).toBeLessThan(TOLERANCE)
    })
  }

  it('returns null for empty or single-point series', () => {
    expect(twror([])).toBeNull()
    expect(twror([{ date: '2026-01-01', valueCents: 1, flowCents: 0 }])).toBeNull()
  })
})

describe('period cash flows and real return', () => {
  it('builds investor-view flows from a value series', () => {
    expect(
      periodCashFlows([
        { date: '2026-01-01', valueCents: 1000, flowCents: 0 },
        { date: '2026-02-01', valueCents: 1600, flowCents: 500 },
        { date: '2026-03-01', valueCents: 1700, flowCents: 0 },
      ]),
    ).toEqual([
      { date: '2026-01-01', amountCents: -1000 },
      { date: '2026-02-01', amountCents: -500 },
      { date: '2026-03-01', amountCents: 1700 },
    ])
  })

  it('deflates nominal returns', () => {
    expect(Number(realReturn('0.1083', '0.0253'))).toBeCloseTo(0.080952, 5)
    expect(realReturn(null, '0.02')).toBeNull()
  })
})
