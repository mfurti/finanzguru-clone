/**
 * Generic CSV with a user-defined column mapping (contracts/csv-formats.md).
 * Required: date, amount. All rows go to one target account chosen at confirm.
 */
import {
  type CsvMappingColumns,
  isValidIban,
  isValidIsin,
  normalizeIban,
  TRANSACTION_TYPES,
  type TransactionType,
} from '@finance/shared'
import { emptyBatch, type NormalizedTransaction, type SyncBatch } from '../data-source.interface'
import type { ParsedCsv } from './detector'
import {
  cell,
  type DateFormat,
  type DecimalSeparator,
  parseCents,
  parseDate,
  parseDecimal,
} from './values'

export const MAPPED_ACCOUNT_REF = 'mapped-target'

export interface GenericMapping {
  columns: CsvMappingColumns
  dateFormat: DateFormat
  decimalSeparator: DecimalSeparator
}

/** German and English words for transaction types in a "type" column. */
const TYPE_WORDS: Record<string, TransactionType> = {
  kauf: 'buy',
  verkauf: 'sell',
  dividende: 'dividend',
  ausschüttung: 'dividend',
  zinsen: 'interest',
  gebühr: 'fee',
  steuer: 'tax',
  einzahlung: 'deposit',
  auszahlung: 'withdrawal',
  umbuchung: 'transfer',
  einnahme: 'income',
  ausgabe: 'expense',
}

function typeFrom(raw: string, amountCents: number, isin: string | undefined): TransactionType {
  const word = raw.trim().toLowerCase()
  if ((TRANSACTION_TYPES as readonly string[]).includes(word)) return word as TransactionType
  if (TYPE_WORDS[word]) return TYPE_WORDS[word]!
  if (isin) return amountCents < 0 ? 'buy' : 'sell'
  return amountCents >= 0 ? 'income' : 'expense'
}

export function parseGenericMapped(csv: ParsedCsv, mapping: GenericMapping): SyncBatch {
  const batch = emptyBatch()
  const c = mapping.columns

  csv.rows.forEach((row, index) => {
    const line = index + 2
    const bookingDate = parseDate(cell(row, c.date), mapping.dateFormat)
    if (!bookingDate) {
      batch.rowErrors.push({ line, reason: 'invalid_date' })
      return
    }
    const amountCents = parseCents(cell(row, c.amount), mapping.decimalSeparator)
    if (amountCents === null) {
      batch.rowErrors.push({ line, reason: 'invalid_amount' })
      return
    }
    const rawIsin = cell(row, c.isin).toUpperCase()
    if (rawIsin && !isValidIsin(rawIsin)) {
      batch.rowErrors.push({ line, reason: 'invalid_isin' })
      return
    }
    const isin = rawIsin || undefined
    const type = typeFrom(cell(row, c.type), amountCents, isin)
    const quantity = parseDecimal(cell(row, c.quantity), mapping.decimalSeparator) ?? undefined
    if ((type === 'buy' || type === 'sell') && (!isin || !quantity)) {
      batch.rowErrors.push({ line, reason: isin ? 'missing_quantity' : 'missing_isin' })
      return
    }
    const iban = normalizeIban(cell(row, c.iban))
    const transaction: NormalizedTransaction = {
      accountExternalRef: MAPPED_ACCOUNT_REF,
      bookingDate,
      valueDate:
        c.valueDate !== undefined
          ? (parseDate(cell(row, c.valueDate), mapping.dateFormat) ?? undefined)
          : undefined,
      amountCents,
      type,
      counterparty: cell(row, c.counterparty) || undefined,
      counterpartyIban: isValidIban(iban) ? iban : undefined,
      purpose: cell(row, c.purpose) || undefined,
      isin,
      quantity,
      unitPrice: parseDecimal(cell(row, c.price), mapping.decimalSeparator) ?? undefined,
      feeCents: Math.abs(parseCents(cell(row, c.fee), mapping.decimalSeparator) ?? 0),
      taxCents: Math.abs(parseCents(cell(row, c.tax), mapping.decimalSeparator) ?? 0),
    }
    batch.transactions.push(transaction)
    if (isin && !batch.instruments.some((instrument) => instrument.isin === isin)) {
      batch.instruments.push({ isin, name: isin, assetClass: 'other', currency: 'EUR' })
    }
  })
  return batch
}
