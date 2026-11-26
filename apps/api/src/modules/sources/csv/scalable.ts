/**
 * Scalable Capital transaction export (contracts/csv-formats.md):
 * `;`, decimal `,`, ISO dates. Securities go to the depot, cash movements
 * (deposits, withdrawals, interest) to its reference account.
 */
import { type AssetClass, isValidIsin, type TransactionType } from '@finance/shared'
import { emptyBatch, type NormalizedTransaction, type SyncBatch } from '../data-source.interface'
import { columnIndex, type ParsedCsv } from './detector'
import { cell, parseCents, parseDate, parseDecimal } from './values'

export const SCALABLE_INSTITUTION = 'Scalable Capital'
export const SCALABLE_DEPOT_REF = 'scalable-depot'
export const SCALABLE_CASH_REF = 'scalable-cash'

const TYPES: Record<string, { type: TransactionType; security: boolean; needsQuantity: boolean }> =
  {
    buy: { type: 'buy', security: true, needsQuantity: true },
    'savings plan': { type: 'buy', security: true, needsQuantity: true },
    sell: { type: 'sell', security: true, needsQuantity: true },
    distribution: { type: 'dividend', security: true, needsQuantity: false },
    dividend: { type: 'dividend', security: true, needsQuantity: false },
    'corporate action': { type: 'split', security: true, needsQuantity: true },
    interest: { type: 'interest', security: false, needsQuantity: false },
    deposit: { type: 'deposit', security: false, needsQuantity: false },
    withdrawal: { type: 'withdrawal', security: false, needsQuantity: false },
    fee: { type: 'fee', security: false, needsQuantity: false },
    taxes: { type: 'tax', security: false, needsQuantity: false },
  }

function assetClassOf(description: string, assetType: string): AssetClass {
  const text = `${description} ${assetType}`.toLowerCase()
  if (/\betf\b|ucits/.test(text)) return 'etf'
  if (/crypto|bitcoin|ethereum/.test(text)) return 'crypto'
  if (/fund|fonds/.test(text)) return 'fund'
  if (/bond|anleihe/.test(text)) return 'bond'
  return 'stock'
}

export function parseScalable(csv: ParsedCsv): SyncBatch {
  const batch = emptyBatch()
  const col = (name: string) => columnIndex(csv.headers, name)
  const idx = {
    date: col('date'),
    status: col('status'),
    reference: col('reference'),
    description: col('description'),
    assetType: col('assettype'),
    type: col('type'),
    isin: col('isin'),
    shares: col('shares'),
    price: col('price'),
    amount: col('amount'),
    fee: col('fee'),
    tax: col('tax'),
    currency: col('currency'),
  }
  const instruments = new Map<string, { name: string; assetClass: AssetClass }>()
  let usesCash = false

  csv.rows.forEach((row, index) => {
    const line = index + 2
    if (cell(row, idx.status).toLowerCase() !== 'executed') {
      batch.rowErrors.push({ line, reason: 'not_executed' })
      return
    }
    const kind = TYPES[cell(row, idx.type).toLowerCase()]
    if (!kind) {
      batch.rowErrors.push({ line, reason: 'unknown_type' })
      return
    }
    const bookingDate = parseDate(cell(row, idx.date), 'YYYY-MM-DD')
    if (!bookingDate) {
      batch.rowErrors.push({ line, reason: 'invalid_date' })
      return
    }
    const amountCents = parseCents(cell(row, idx.amount) || '0', ',')
    if (amountCents === null) {
      batch.rowErrors.push({ line, reason: 'invalid_amount' })
      return
    }
    if ((cell(row, idx.currency) || 'EUR').toUpperCase() !== 'EUR') {
      batch.rowErrors.push({ line, reason: 'unknown_currency_no_rate' })
      return
    }

    const isin = cell(row, idx.isin).toUpperCase()
    if (kind.security) {
      if (!isin) {
        batch.rowErrors.push({ line, reason: 'missing_isin' })
        return
      }
      if (!isValidIsin(isin)) {
        batch.rowErrors.push({ line, reason: 'invalid_isin' })
        return
      }
    }
    const quantity = parseDecimal(cell(row, idx.shares), ',')
    if (kind.needsQuantity && (!quantity || Number(quantity) <= 0)) {
      batch.rowErrors.push({ line, reason: 'missing_quantity' })
      return
    }
    const unitPrice = parseDecimal(cell(row, idx.price), ',') ?? undefined

    const transaction: NormalizedTransaction = {
      accountExternalRef: kind.security ? SCALABLE_DEPOT_REF : SCALABLE_CASH_REF,
      sourceRef: cell(row, idx.reference) || undefined,
      bookingDate,
      amountCents,
      type: kind.type,
      counterparty: SCALABLE_INSTITUTION,
      purpose: cell(row, idx.description) || undefined,
      isin: kind.security ? isin : undefined,
      quantity: kind.needsQuantity ? (quantity ?? undefined) : undefined,
      unitPrice,
      feeCents: Math.abs(parseCents(cell(row, idx.fee) || '0', ',') ?? 0),
      taxCents: Math.abs(parseCents(cell(row, idx.tax) || '0', ',') ?? 0),
    }
    batch.transactions.push(transaction)
    if (!kind.security) usesCash = true

    if (kind.security && !instruments.has(isin)) {
      const description = cell(row, idx.description)
      instruments.set(isin, {
        name: description || isin,
        assetClass: assetClassOf(description, cell(row, idx.assetType)),
      })
    }
    if (kind.security && unitPrice && (kind.type === 'buy' || kind.type === 'sell')) {
      batch.prices.push({ isin, date: bookingDate, close: unitPrice })
    }
  })

  for (const [isin, info] of instruments) {
    batch.instruments.push({ isin, name: info.name, assetClass: info.assetClass, currency: 'EUR' })
  }
  if (batch.transactions.some((tx) => tx.accountExternalRef === SCALABLE_DEPOT_REF)) {
    batch.accounts.push({
      externalRef: SCALABLE_DEPOT_REF,
      name: 'Scalable Capital Depot',
      type: 'depot',
      institutionName: SCALABLE_INSTITUTION,
    })
  }
  if (usesCash) {
    batch.accounts.push({
      externalRef: SCALABLE_CASH_REF,
      name: 'Scalable Capital Referenzkonto',
      type: 'reference',
      institutionName: SCALABLE_INSTITUTION,
      parentExternalRef: SCALABLE_DEPOT_REF,
    })
  }
  return batch
}
