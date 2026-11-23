/**
 * FIFO position accounting per depot (research R9).
 * Buys open lots (cost incl. fees), sells consume the oldest lots first,
 * splits scale open lots, dividends are collected per instrument.
 */
import { D, type DecimalValue, eurosToCents, valueCents } from './money'

export interface PositionTx {
  bookingDate: string
  type: string
  instrumentId: string | null
  quantity: string | null
  unitPrice: string | null
  amountCents: number
  feeCents: number
  taxCents: number
}

export interface Lot {
  openDate: string
  quantity: DecimalValue
  /** EUR per unit, incl. the buy fee share. */
  costPerUnit: DecimalValue
}

export interface PositionState {
  instrumentId: string
  lots: Lot[]
  realizedGrossCents: number
  realizedNetCents: number
  dividendsCents: number
  /** Last known trade price (fallback when no market price exists). */
  lastTradePrice: DecimalValue | null
  everHeld: boolean
}

export interface PositionSummary {
  instrumentId: string
  quantity: string
  investedCents: number
  /** Weighted average cost of open lots (EUR), or null when nothing is open. */
  avgPrice: string | null
  realizedGrossCents: number
  realizedNetCents: number
  dividendsCents: number
  /** Held before, nothing open now. */
  sold: boolean
}

const EPSILON = new D('1e-12')

export function newPosition(instrumentId: string): PositionState {
  return {
    instrumentId,
    lots: [],
    realizedGrossCents: 0,
    realizedNetCents: 0,
    dividendsCents: 0,
    lastTradePrice: null,
    everHeld: false,
  }
}

/** Gross trade value in cents: quantity × unit price, else |amount| (minus fee for buys). */
function grossCents(tx: PositionTx, quantity: DecimalValue): number {
  if (tx.unitPrice) return valueCents(quantity, tx.unitPrice)
  return Math.abs(tx.amountCents)
}

export function quantityOf(state: PositionState): DecimalValue {
  return state.lots.reduce((sum, lot) => sum.plus(lot.quantity), new D(0))
}

export function investedCentsOf(state: PositionState): number {
  return eurosToCents(
    state.lots.reduce((sum, lot) => sum.plus(lot.quantity.times(lot.costPerUnit)), new D(0)),
  )
}

/** Applies one transaction to the position state (mutates and returns it). */
export function applyPositionTx(state: PositionState, tx: PositionTx): PositionState {
  switch (tx.type) {
    case 'buy': {
      const quantity = new D(tx.quantity ?? 0)
      if (quantity.lte(0)) throw new Error(`Buy without positive quantity on ${tx.bookingDate}`)
      const costCents = grossCents(tx, quantity) + tx.feeCents
      state.lots.push({
        openDate: tx.bookingDate,
        quantity,
        costPerUnit: new D(costCents).dividedBy(100).dividedBy(quantity),
      })
      state.lastTradePrice = tx.unitPrice
        ? new D(tx.unitPrice)
        : new D(costCents).dividedBy(100).dividedBy(quantity)
      state.everHeld = true
      break
    }
    case 'sell': {
      let remaining = new D(tx.quantity ?? 0)
      if (remaining.lte(0)) throw new Error(`Sell without positive quantity on ${tx.bookingDate}`)
      const soldQuantity = remaining
      let costBasis = new D(0)
      while (remaining.gt(EPSILON)) {
        const lot = state.lots[0]
        if (!lot) {
          throw new Error(
            `Sell of ${soldQuantity.toString()} exceeds open quantity on ${tx.bookingDate}`,
          )
        }
        const take = D.min(lot.quantity, remaining)
        costBasis = costBasis.plus(take.times(lot.costPerUnit))
        lot.quantity = lot.quantity.minus(take)
        remaining = remaining.minus(take)
        if (lot.quantity.lte(EPSILON)) state.lots.shift()
      }
      const proceedsCents = grossCents(tx, soldQuantity)
      const gross = proceedsCents - eurosToCents(costBasis)
      state.realizedGrossCents += gross
      state.realizedNetCents += gross - tx.feeCents - tx.taxCents
      if (tx.unitPrice) state.lastTradePrice = new D(tx.unitPrice)
      break
    }
    case 'split': {
      const ratio = new D(tx.quantity ?? 0)
      if (ratio.lte(0)) throw new Error(`Split without positive ratio on ${tx.bookingDate}`)
      for (const lot of state.lots) {
        lot.quantity = lot.quantity.times(ratio)
        lot.costPerUnit = lot.costPerUnit.dividedBy(ratio)
      }
      if (state.lastTradePrice) state.lastTradePrice = state.lastTradePrice.dividedBy(ratio)
      break
    }
    case 'dividend':
      state.dividendsCents += tx.amountCents
      break
    default:
      break
  }
  return state
}

export function summarize(state: PositionState): PositionSummary {
  const quantity = quantityOf(state)
  const investedCents = investedCentsOf(state)
  return {
    instrumentId: state.instrumentId,
    quantity: quantity.toString(),
    investedCents,
    avgPrice: quantity.gt(0)
      ? new D(investedCents).dividedBy(100).dividedBy(quantity).toDecimalPlaces(6).toString()
      : null,
    realizedGrossCents: state.realizedGrossCents,
    realizedNetCents: state.realizedNetCents,
    dividendsCents: state.dividendsCents,
    sold: state.everHeld && quantity.lte(EPSILON),
  }
}

/**
 * Runs all depot transactions (any order; sorted by booking date, stable) and
 * returns one state per instrument.
 */
export function computePositions(transactions: readonly PositionTx[]): Map<string, PositionState> {
  const states = new Map<string, PositionState>()
  const sorted = [...transactions].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
  for (const tx of sorted) {
    if (!tx.instrumentId) continue
    let state = states.get(tx.instrumentId)
    if (!state) {
      state = newPosition(tx.instrumentId)
      states.set(tx.instrumentId, state)
    }
    applyPositionTx(state, tx)
  }
  return states
}
