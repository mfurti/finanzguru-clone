/**
 * Scalable MCP read-tool results → SyncBatch (004 T007). Shapes come from the
 * real responses recorded on 2026-11-24 (test/fixtures/scalable-mcp/).
 *
 * Conventions match the Scalable CSV import (csv/scalable.ts) so both feed the
 * same accounts: securities go to the depot, cash movements to its reference
 * account; the first portfolio uses the CSV refs, further ones get suffixed refs.
 */
import { isValidIsin, type AssetClass, type TransactionType } from '@finance/shared'
import { D } from '../../../domain/money'
import { emptyBatch, type NormalizedTransaction, type SyncBatch } from '../data-source.interface'
import { SCALABLE_CASH_REF, SCALABLE_DEPOT_REF, SCALABLE_INSTITUTION } from '../csv/scalable'

export interface ScalablePortfolio {
  portfolioId: string
  displayName?: string
}
export interface ScalableHolding {
  isin: string
  name: string
  valuationCurrency?: string
  currentQuote?: { currency?: string; midPrice?: number; timestamp?: string }
  position?: { filled?: number; blocked?: number; pending?: number }
}
export interface ScalableCash {
  cash?: { cashBalance?: number }
}
export interface ScalableTransaction {
  id: string
  kind: 'security' | 'cash' | string
  status: string
  currency: string
  isCancellation?: boolean
  lastEventAt: string
  description?: string
  security?: {
    isin: string
    transactionType?: string | null
    quantity: string
    amount: string
    side?: 'BUY' | 'SELL' | null
  } | null
  cash?: { relatedIsin?: string | null; transactionType: string; amount: string } | null
  /** Depot transfers without a trade (TRANSFER_IN / TRANSFER_OUT). */
  nonTradeSecurity?: {
    isin: string
    transactionType: string
    quantity: string
    amount: string
  } | null
}
export interface PortfolioData {
  portfolio: ScalablePortfolio
  holdings: ScalableHolding[]
  cash: ScalableCash | null
  transactions: ScalableTransaction[]
}

const CASH_TYPES: Record<string, TransactionType> = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  FEE: 'fee',
  INTEREST: 'interest',
  TAX: 'tax',
  TAXES: 'tax',
  TAX_RETURN: 'tax',
  DIVIDEND: 'dividend',
  DISTRIBUTION: 'dividend',
}
/** Always outflows from the account's view, whatever sign Scalable sends. */
const OUTFLOWS = new Set(['WITHDRAWAL', 'FEE'])
/** Always inflows. Taxes keep Scalable's sign (TAX negative, TAX_RETURN positive). */
const INFLOWS = new Set(['DEPOSIT', 'INTEREST', 'DIVIDEND', 'DISTRIBUTION', 'TAX_RETURN'])

function assetClassOf(name: string): AssetClass {
  const text = name.toLowerCase()
  if (/\betf\b|ucits|etc\b/.test(text)) return 'etf'
  if (/crypto|bitcoin|ethereum/.test(text)) return 'crypto'
  if (/fund|fonds/.test(text)) return 'fund'
  if (/bond|anleihe/.test(text)) return 'bond'
  return 'stock'
}

/** Euro decimal string or number → integer cents (half-even). */
function cents(value: string | number): number {
  return new D(String(value)).times(100).toDecimalPlaces(0, D.ROUND_HALF_EVEN).toNumber()
}

/** Booking date in Europe/Berlin (Scalable timestamps are UTC). */
export function berlinDate(timestamp: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(timestamp))
}

export function refsFor(index: number, portfolioId: string): { depot: string; cash: string } {
  return index === 0
    ? { depot: SCALABLE_DEPOT_REF, cash: SCALABLE_CASH_REF }
    : { depot: `${SCALABLE_DEPOT_REF}:${portfolioId}`, cash: `${SCALABLE_CASH_REF}:${portfolioId}` }
}

export function mapScalable(portfolios: readonly PortfolioData[]): SyncBatch {
  const batch = emptyBatch()
  const snapshot: NonNullable<SyncBatch['positionsSnapshot']> = []
  batch.positionsSnapshot = snapshot
  const instruments = new Map<string, { name: string; assetClass: AssetClass }>()
  const note = (isin: string, name: string) => {
    if (!instruments.has(isin)) instruments.set(isin, { name, assetClass: assetClassOf(name) })
  }

  portfolios.forEach((data, index) => {
    const refs = refsFor(index, data.portfolio.portfolioId)
    const suffix = portfolios.length > 1 ? ` (${data.portfolio.displayName ?? index + 1})` : ''
    batch.accounts.push({
      externalRef: refs.depot,
      name: `Scalable Capital Depot${suffix}`,
      type: 'depot',
      institutionName: SCALABLE_INSTITUTION,
    })
    batch.accounts.push({
      externalRef: refs.cash,
      name: `Scalable Capital Referenzkonto${suffix}`,
      type: 'reference',
      institutionName: SCALABLE_INSTITUTION,
      parentExternalRef: refs.depot,
      ...(data.cash?.cash?.cashBalance !== undefined
        ? { balanceCents: cents(data.cash.cash.cashBalance) }
        : {}),
    })

    for (const holding of data.holdings) {
      if (!isValidIsin(holding.isin)) continue
      note(holding.isin, holding.name)
      const quantity = new D(String(holding.position?.filled ?? 0))
        .plus(String(holding.position?.blocked ?? 0))
        .toString()
      snapshot.push({ accountExternalRef: refs.depot, isin: holding.isin, quantity })
      const quote = holding.currentQuote
      if (quote?.midPrice && quote.timestamp && (quote.currency ?? 'EUR') === 'EUR') {
        batch.prices.push({
          isin: holding.isin,
          date: berlinDate(quote.timestamp),
          close: String(quote.midPrice),
        })
      }
    }

    for (const tx of withoutCancelled(data.transactions)) {
      const mapped = mapTransaction(tx, refs, batch.rowErrors)
      if (!mapped) continue
      batch.transactions.push(mapped)
      if (mapped.isin) note(mapped.isin, tx.description || mapped.isin)
    }
  })

  for (const [isin, info] of instruments) {
    batch.instruments.push({ isin, name: info.name, assetClass: info.assetClass, currency: 'EUR' })
  }
  return batch
}

/**
 * A cancellation (`isCancellation`) reverses an earlier booking with the same
 * security, quantity and amount (opposite sign). Both are dropped; a
 * cancellation without its original is dropped alone.
 */
export function withoutCancelled(
  transactions: readonly ScalableTransaction[],
): ScalableTransaction[] {
  const dropped = new Set<string>()
  const key = (tx: ScalableTransaction) =>
    tx.security
      ? `s|${tx.security.isin}|${new D(tx.security.quantity).abs()}|${new D(tx.security.amount).abs()}`
      : tx.cash
        ? `c|${tx.cash.transactionType}|${new D(tx.cash.amount).abs()}`
        : `x|${tx.id}`
  for (const cancellation of transactions.filter((tx) => tx.isCancellation)) {
    dropped.add(cancellation.id)
    const candidates = transactions.filter(
      (tx) => !tx.isCancellation && !dropped.has(tx.id) && key(tx) === key(cancellation),
    )
    // Prefer the booking with the same timestamp, else the latest one before it.
    const original =
      candidates.find((tx) => tx.lastEventAt === cancellation.lastEventAt) ??
      candidates
        .filter((tx) => tx.lastEventAt <= cancellation.lastEventAt)
        .sort((a, b) => b.lastEventAt.localeCompare(a.lastEventAt))[0]
    if (original) dropped.add(original.id)
  }
  return transactions.filter((tx) => !dropped.has(tx.id))
}

function mapTransaction(
  tx: ScalableTransaction,
  refs: { depot: string; cash: string },
  errors: SyncBatch['rowErrors'],
): NormalizedTransaction | null {
  // Only settled, non-cancelled EUR bookings; pending orders come with a later sync.
  if (tx.status !== 'SETTLED' || tx.isCancellation) return null
  if ((tx.currency || 'EUR').toUpperCase() !== 'EUR') {
    errors.push({ reason: `unknown_currency_no_rate:${tx.id}` })
    return null
  }
  const bookingDate = berlinDate(tx.lastEventAt)
  const base = {
    sourceRef: tx.id,
    bookingDate,
    counterparty: SCALABLE_INSTITUTION,
    purpose: tx.description || undefined,
  }

  if (tx.security && tx.kind !== 'non_trade_security') {
    const s = tx.security
    if (!isValidIsin(s.isin)) {
      errors.push({ reason: `invalid_isin:${tx.id}` })
      return null
    }
    const quantity = new D(s.quantity).abs()
    if (quantity.lte(0) || !s.side) {
      errors.push({ reason: `missing_quantity:${tx.id}` })
      return null
    }
    const amountCents = cents(s.amount)
    return {
      ...base,
      accountExternalRef: refs.depot,
      type: s.side === 'SELL' ? 'sell' : 'buy',
      amountCents,
      isin: s.isin,
      quantity: quantity.toString(),
      unitPrice: new D(s.amount).abs().dividedBy(quantity).toDecimalPlaces(6).toString(),
    }
  }

  if (tx.nonTradeSecurity) {
    const n = tx.nonTradeSecurity
    const incoming = n.transactionType.toUpperCase() === 'TRANSFER_IN'
    const outgoing = n.transactionType.toUpperCase() === 'TRANSFER_OUT'
    const quantity = new D(n.quantity).abs()
    if (!(incoming || outgoing) || !isValidIsin(n.isin) || quantity.lte(0)) {
      errors.push({ reason: `unknown_type:${n.transactionType}` })
      return null
    }
    // A depot transfer moves shares at their value: booked like a buy/sell at that value.
    const value = new D(n.amount).abs()
    return {
      ...base,
      accountExternalRef: refs.depot,
      type: incoming ? 'buy' : 'sell',
      amountCents: (incoming ? -1 : 1) * cents(value.toString()),
      isin: n.isin,
      quantity: quantity.toString(),
      unitPrice: value.dividedBy(quantity).toDecimalPlaces(6).toString(),
      purpose: incoming ? 'Depotübertrag (eingehend)' : 'Depotübertrag (ausgehend)',
    }
  }

  if (tx.cash) {
    const type = CASH_TYPES[tx.cash.transactionType.toUpperCase()]
    if (!type) {
      errors.push({ reason: `unknown_type:${tx.cash.transactionType}` })
      return null
    }
    const amount = cents(tx.cash.amount)
    // Zero-amount cash entries (e.g. 0,00 € interest notices) carry no booking.
    if (amount === 0) return null
    const relatedIsin =
      tx.cash.relatedIsin && isValidIsin(tx.cash.relatedIsin) ? tx.cash.relatedIsin : undefined
    const dividend = type === 'dividend' && relatedIsin
    return {
      ...base,
      accountExternalRef: dividend ? refs.depot : refs.cash,
      type: dividend ? 'dividend' : type === 'dividend' ? 'interest' : type,
      amountCents: OUTFLOWS.has(tx.cash.transactionType.toUpperCase())
        ? -Math.abs(amount)
        : INFLOWS.has(tx.cash.transactionType.toUpperCase())
          ? Math.abs(amount)
          : amount,
      ...(dividend ? { isin: relatedIsin } : {}),
    }
  }
  errors.push({ reason: `unknown_kind:${tx.kind}` })
  return null
}
