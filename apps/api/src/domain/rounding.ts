/**
 * Largest-remainder rounding: splits `totalCents` proportionally to `values`
 * so that the integer parts always add up to `totalCents` exactly. Used for
 * breakdown buckets (SC-001). Ties go to the earlier index (stable order).
 */
export function largestRemainder(values: readonly number[], totalCents: number): number[] {
  const sum = values.reduce((acc, value) => acc + value, 0)
  if (values.length === 0) return []
  if (sum === 0) return values.map((_, index) => (index === 0 ? totalCents : 0))

  const exact = values.map((value) => (value / sum) * totalCents)
  const floors = exact.map((value) => Math.floor(value))
  let rest = totalCents - floors.reduce((acc, value) => acc + value, 0)
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of order) {
    if (rest <= 0) break
    floors[index]! += 1
    rest -= 1
  }
  return floors
}
