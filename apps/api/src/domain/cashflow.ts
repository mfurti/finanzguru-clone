/**
 * Cash-flow aggregation for the Budget tab (FR-030, FR-032).
 * Only cash accounts count (depots are investments, not spending).
 * Transfers between own accounts are ignored. Outflows booked to a category
 * of kind `savings` (e.g. "Sparen und Anlegen › Wertpapieranlage") count as
 * expenses and additionally as "Gespart".
 */
import type { CategoryKind, TransactionType } from '@finance/shared'
import { ratio } from './money'
import { type Granularity, lastPeriods, type PeriodBounds } from './period'

export interface CashflowTx {
  bookingDate: string
  amountCents: number
  type: TransactionType
  categoryId: string | null
}

export interface CategoryInfo {
  id: string
  parentId: string | null
  name: string
  kind: CategoryKind
  color: string
}

export const UNCATEGORIZED = 'uncategorized'

const IGNORED: ReadonlySet<TransactionType> = new Set([
  'transfer',
  'buy',
  'sell',
  'split',
  'deposit',
  'withdrawal',
])

export interface PeriodTotals {
  incomeCents: number
  /** Positive number: sum of all outflows except transfers. */
  expenseCents: number
  balanceCents: number
  savedCents: number
  savingsRate: string | null
}

function isSavings(tx: CashflowTx, categories: ReadonlyMap<string, CategoryInfo>): boolean {
  if (!tx.categoryId) return false
  return categories.get(tx.categoryId)?.kind === 'savings'
}

export function relevant(tx: CashflowTx): boolean {
  return !IGNORED.has(tx.type)
}

export function totals(
  txs: readonly CashflowTx[],
  categories: ReadonlyMap<string, CategoryInfo>,
): PeriodTotals {
  let income = 0
  let expense = 0
  let saved = 0
  for (const tx of txs) {
    if (!relevant(tx)) continue
    if (tx.amountCents >= 0) income += tx.amountCents
    else {
      expense += -tx.amountCents
      if (isSavings(tx, categories)) saved += -tx.amountCents
    }
  }
  return {
    incomeCents: income,
    expenseCents: expense,
    balanceCents: income - expense,
    savedCents: saved,
    savingsRate: ratio(saved, income, 6),
  }
}

export interface Bar {
  label: string
  from: string
  to: string
  incomeCents: number
  expenseCents: number
  isCurrent: boolean
}

/** Income/expense bars for the `count` periods ending with the anchor period. */
export function bars(
  txs: readonly CashflowTx[],
  categories: ReadonlyMap<string, CategoryInfo>,
  granularity: Granularity,
  anchor: string,
  today: string,
  count = 12,
): Bar[] {
  return lastPeriods(granularity, anchor, count).map((period: PeriodBounds) => {
    const inPeriod = txs.filter(
      (tx) => tx.bookingDate >= period.from && tx.bookingDate <= period.to,
    )
    const sums = totals(inPeriod, categories)
    return {
      label: period.label,
      from: period.from,
      to: period.to,
      incomeCents: sums.incomeCents,
      expenseCents: sums.expenseCents,
      isCurrent: today >= period.from && today <= period.to,
    }
  })
}

/** Main category of a category id (itself when it is a main category). */
export function mainOf(
  categoryId: string | null,
  categories: ReadonlyMap<string, CategoryInfo>,
): CategoryInfo | null {
  if (!categoryId) return null
  const category = categories.get(categoryId)
  if (!category) return null
  return category.parentId ? (categories.get(category.parentId) ?? category) : category
}

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  count: number
  totalCents: number
  pct: string | null
  children: Omit<CategoryTotal, 'children'>[]
}

/** Per main category (with sub categories) for expenses or income in one period. */
export function categoryTotals(
  txs: readonly CashflowTx[],
  categories: ReadonlyMap<string, CategoryInfo>,
  kind: 'expense' | 'income',
): { totalCents: number; count: number; items: CategoryTotal[] } {
  const rows = txs.filter(
    (tx) => relevant(tx) && (kind === 'income' ? tx.amountCents >= 0 : tx.amountCents < 0),
  )
  const mains = new Map<string, CategoryTotal>()
  let total = 0
  for (const tx of rows) {
    const value = Math.abs(tx.amountCents)
    total += value
    const main = mainOf(tx.categoryId, categories)
    const mainId = main?.id ?? UNCATEGORIZED
    const entry =
      mains.get(mainId) ??
      ({
        categoryId: mainId,
        name: main?.name ?? 'Nicht kategorisiert',
        color: main?.color ?? 'neutral',
        count: 0,
        totalCents: 0,
        pct: null,
        children: [],
      } satisfies CategoryTotal)
    entry.count += 1
    entry.totalCents += value
    const sub = tx.categoryId ? categories.get(tx.categoryId) : undefined
    if (sub?.parentId) {
      let child = entry.children.find((item) => item.categoryId === sub.id)
      if (!child) {
        child = {
          categoryId: sub.id,
          name: sub.name,
          color: sub.color,
          count: 0,
          totalCents: 0,
          pct: null,
        }
        entry.children.push(child)
      }
      child.count += 1
      child.totalCents += value
    }
    mains.set(mainId, entry)
  }
  const items = [...mains.values()]
    .map((item) => ({
      ...item,
      pct: ratio(item.totalCents, total, 6),
      children: item.children
        .map((child) => ({ ...child, pct: ratio(child.totalCents, total, 6) }))
        .sort((a, b) => b.totalCents - a.totalCents),
    }))
    .sort((a, b) => b.totalCents - a.totalCents)
  return { totalCents: total, count: rows.length, items }
}

export interface SankeyNode {
  id: string
  label: string
  kind: 'income' | 'main' | 'sub' | 'balance'
}

export interface SankeyLink {
  source: string
  target: string
  valueCents: number
}

/** Income → main expense categories → sub categories (plus the unspent rest). */
export function sankey(
  txs: readonly CashflowTx[],
  categories: ReadonlyMap<string, CategoryInfo>,
): { nodes: SankeyNode[]; links: SankeyLink[] } {
  const sums = totals(txs, categories)
  const expenses = categoryTotals(txs, categories, 'expense')
  const nodes: SankeyNode[] = [{ id: 'income', label: 'Einnahmen', kind: 'income' }]
  const links: SankeyLink[] = []
  for (const main of expenses.items) {
    nodes.push({ id: `main:${main.categoryId}`, label: main.name, kind: 'main' })
    links.push({ source: 'income', target: `main:${main.categoryId}`, valueCents: main.totalCents })
    for (const child of main.children) {
      nodes.push({ id: `sub:${child.categoryId}`, label: child.name, kind: 'sub' })
      links.push({
        source: `main:${main.categoryId}`,
        target: `sub:${child.categoryId}`,
        valueCents: child.totalCents,
      })
    }
  }
  if (sums.balanceCents > 0) {
    nodes.push({ id: 'rest', label: 'Übrig', kind: 'balance' })
    links.push({ source: 'income', target: 'rest', valueCents: sums.balanceCents })
  }
  return { nodes, links }
}
