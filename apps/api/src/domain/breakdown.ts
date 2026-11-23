/**
 * Weighted portfolio breakdown (feature 002, research R1/R2).
 * Each holding's value is split by its weights; the remainder up to 100 %
 * goes to "Nicht zugeordnet". Buckets are rounded with largest remainder so
 * they always add up to the total value to the cent (SC-001).
 */
import { UNASSIGNED_KEY } from '@finance/shared'
import { D } from './money'
import { largestRemainder } from './rounding'

export interface WeightedHolding {
  instrumentId: string
  valueCents: number
  /** Weights of one dimension; Σ <= 1. Empty = fully unassigned. */
  weights: readonly { key: string; weight: string }[]
}

export interface Bucket {
  key: string
  valueCents: number
  /** Number of holdings with a share in this bucket. */
  count: number
}

export function weightedBreakdown(holdings: readonly WeightedHolding[]): Bucket[] {
  const raw = new Map<string, { value: InstanceType<typeof D>; count: number }>()
  const add = (key: string, value: InstanceType<typeof D>) => {
    if (value.isZero()) return
    const entry = raw.get(key) ?? { value: new D(0), count: 0 }
    entry.value = entry.value.plus(value)
    entry.count += 1
    raw.set(key, entry)
  }

  for (const holding of holdings) {
    let assigned = new D(0)
    for (const { key, weight } of holding.weights) {
      assigned = assigned.plus(weight)
      add(key, new D(holding.valueCents).times(weight))
    }
    const rest = D.max(new D(1).minus(assigned), 0)
    add(UNASSIGNED_KEY, new D(holding.valueCents).times(rest))
  }

  const total = holdings.reduce((sum, holding) => sum + holding.valueCents, 0)
  const entries = [...raw.entries()]
  const rounded = largestRemainder(
    entries.map(([, entry]) => entry.value.toNumber()),
    total,
  )
  return entries
    .map(([key, entry], index) => ({ key, valueCents: rounded[index]!, count: entry.count }))
    .sort((a, b) => {
      if (a.key === UNASSIGNED_KEY) return 1
      if (b.key === UNASSIGNED_KEY) return -1
      return b.valueCents - a.valueCents || a.key.localeCompare(b.key)
    })
}

/** Breakdown where every holding belongs to exactly one bucket (asset class, group). */
export function groupedBreakdown(
  holdings: readonly { valueCents: number; key: string | null }[],
): Bucket[] {
  return weightedBreakdown(
    holdings.map((holding, index) => ({
      instrumentId: String(index),
      valueCents: holding.valueCents,
      weights: holding.key ? [{ key: holding.key, weight: '1' }] : [],
    })),
  )
}
