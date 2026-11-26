/**
 * Sparkasse online-banking exports "CSV-CAMT V8" and "CSV-MT940"
 * (contracts/csv-formats.md). Both: `;`, decimal `,`, dates `DD.MM.YY`.
 */
import { isValidIban, normalizeIban } from '@finance/shared'
import { emptyBatch, type NormalizedTransaction, type SyncBatch } from '../data-source.interface'
import { columnIndex, type ParsedCsv } from './detector'
import { cell, parseCents, parseDate } from './values'

export const SPARKASSE_INSTITUTION = 'Sparkasse'

/** Rows the bank only pre-noted ("vorgemerkt") are not booked yet. */
const NOT_BOOKED = /vorgemerkt/i

export function parseSparkasse(csv: ParsedCsv, variant: 'camt' | 'mt940'): SyncBatch {
  const batch = emptyBatch()
  const col = (name: string) => columnIndex(csv.headers, name)
  const idx = {
    account: col('auftragskonto'),
    booking: col('buchungstag'),
    value: col('valutadatum'),
    text: col('buchungstext'),
    purpose: col('verwendungszweck'),
    party: col('beguenstigter/zahlungspflichtiger'),
    iban: variant === 'camt' ? col('kontonummer/iban') : -1,
    amount: col('betrag'),
    currency: col('waehrung'),
    info: col('info'),
  }

  const accounts = new Map<string, string>()
  csv.rows.forEach((row, index) => {
    const line = index + 2
    if (NOT_BOOKED.test(cell(row, idx.info))) {
      batch.rowErrors.push({ line, reason: 'not_booked' })
      return
    }
    const bookingDate = parseDate(cell(row, idx.booking), 'DD.MM.YY')
    if (!bookingDate) {
      batch.rowErrors.push({ line, reason: 'invalid_date' })
      return
    }
    const amountCents = parseCents(cell(row, idx.amount), ',')
    if (amountCents === null) {
      batch.rowErrors.push({ line, reason: 'invalid_amount' })
      return
    }
    const currency = cell(row, idx.currency) || 'EUR'
    if (currency.toUpperCase() !== 'EUR') {
      batch.rowErrors.push({ line, reason: 'unknown_currency_no_rate' })
      return
    }

    const ownAccount = normalizeIban(cell(row, idx.account))
    const accountRef = ownAccount || 'sparkasse-unknown'
    accounts.set(accountRef, ownAccount)

    const counterpartyIban = normalizeIban(cell(row, idx.iban))
    const text = cell(row, idx.text)
    const transaction: NormalizedTransaction = {
      accountExternalRef: accountRef,
      bookingDate,
      valueDate: parseDate(cell(row, idx.value), 'DD.MM.YY') ?? undefined,
      amountCents,
      type: /entgelt/i.test(text) ? 'fee' : amountCents >= 0 ? 'income' : 'expense',
      counterparty: cell(row, idx.party) || undefined,
      counterpartyIban: isValidIban(counterpartyIban) ? counterpartyIban : undefined,
      purpose: [text, cell(row, idx.purpose)].filter(Boolean).join(' · ') || undefined,
    }
    batch.transactions.push(transaction)
  })

  for (const [externalRef, iban] of accounts) {
    batch.accounts.push({
      externalRef,
      name: iban ? `Sparkasse Girokonto …${iban.slice(-4)}` : 'Sparkasse Girokonto',
      type: 'checking',
      iban: isValidIban(iban) ? iban : undefined,
      institutionName: SPARKASSE_INSTITUTION,
    })
  }
  return batch
}
