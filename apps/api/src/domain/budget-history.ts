/** Budget vs. spending (003 US4, research R12). Pure: callers pass spending per month. */
export interface BudgetLine {
  id: string
  limitCents: number
  /** `YYYY-MM` of creation; earlier months have no budget (gap, not 0). */
  createdMonth: string
}

export interface BudgetPoint {
  budgetCents: number | null
  spentCents: number
}

/** spent / limit as a 4-digit decimal string ("0.8200"); "0" without a limit. */
export function ratio(spentCents: number, limitCents: number): string {
  if (limitCents <= 0) return '0'
  return (spentCents / limitCents).toFixed(4)
}

export function figures(limitCents: number, spentCents: number) {
  return {
    limitCents,
    spentCents,
    ratio: ratio(spentCents, limitCents),
    diffCents: limitCents - spentCents,
  }
}

/**
 * One point per month and budget plus the total. The total's budget is the sum
 * of the budgets that existed in that month, or null when none existed yet.
 */
export function budgetSeries(
  lines: readonly BudgetLine[],
  months: readonly string[],
  spent: (budgetId: string, month: string) => number,
): { month: string; total: BudgetPoint; byBudget: Record<string, BudgetPoint> }[] {
  return months.map((month) => {
    const byBudget: Record<string, BudgetPoint> = {}
    let budgetSum = 0
    let anyBudget = false
    let spentSum = 0
    for (const line of lines) {
      const exists = line.createdMonth <= month
      const spentCents = spent(line.id, month)
      byBudget[line.id] = { budgetCents: exists ? line.limitCents : null, spentCents }
      if (exists) {
        anyBudget = true
        budgetSum += line.limitCents
      }
      spentSum += spentCents
    }
    return {
      month,
      total: { budgetCents: anyBudget ? budgetSum : null, spentCents: spentSum },
      byBudget,
    }
  })
}
