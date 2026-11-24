/**
 * Maps Enable Banking account data to a SyncBatch (005 T009, research R2/R3).
 *
 * Only booked entries (`status = BOOK`) are imported; amounts are parsed from decimal strings
 * to cents half-even, the sign comes from `credit_debit_indicator`. Each booking gets a stable
 * `sourceRef` (the bank's `entry_reference`, else a hash of the booking) so repeated syncs skip it.
 */
import { createHash } from 'node:crypto'
import { emptyBatch, isValidIban, normalizeIban, type SyncBatch } from '@finance/shared'
import { eurosToCents } from '../../../domain/money'
import type { Balance, BankTransaction, SessionAccount } from './client'

export interface BankAccountData {
  uid: string
  details: SessionAccount
  balances: Balance[]
  transactions: BankTransaction[]
}

export interface BankData {
  /** Bank name the consent was given at, e.g. "Sparkasse KölnBonn". */
  institution: string
  accounts: BankAccountData[]
}

/** Preferred balance types: booked closing balance first (R3). */
const BALANCE_PRIORITY = ['CLBD', 'ITAV', 'XPCD', 'CLAV', 'ITBD']

/** Batch-local account reference for a consent account. */
export const bankRef = (uid: string) => `eb:${uid}`

/** Picks the balance to show; undefined when the bank sends none in EUR. */
export function pickBalance(balances: readonly Balance[]): number | undefined {
  const eur = balances.filter((b) => b.balance_amount.currency.toUpperCase() === 'EUR')
  for (const type of BALANCE_PRIORITY) {
    const hit = eur.find((b) => b.balance_type === type)
    if (hit) return eurosToCents(hit.balance_amount.amount)
  }
  return eur[0] ? eurosToCents(eur[0].balance_amount.amount) : undefined
}

/** Hash of the fields that identify a booking when the bank sends no entry reference. */
function bookingHash(tx: BankTransaction): string {
  const key = [
    tx.booking_date,
    tx.value_date,
    tx.transaction_amount.amount,
    tx.credit_debit_indicator,
    tx.creditor?.name,
    tx.debtor?.name,
    (tx.remittance_information ?? []).join('|'),
  ].join('#')
  return `h:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`
}

/** Display name like the CSV import: "<Bank> Girokonto …1234". */
function accountName(institution: string, details: SessionAccount, iban: string | undefined) {
  const base = details.name?.trim() || `${institution} Girokonto`
  return iban && !base.includes(iban.slice(-4)) ? `${base} …${iban.slice(-4)}` : base
}

export function mapBankData(data: BankData): SyncBatch {
  const batch = emptyBatch()
  for (const item of data.accounts) {
    const ref = bankRef(item.uid)
    const rawIban = item.details.account_id?.iban
    const iban = rawIban && isValidIban(rawIban) ? normalizeIban(rawIban) : undefined
    batch.accounts.push({
      externalRef: ref,
      name: accountName(data.institution, item.details, iban),
      type: 'checking',
      iban,
      institutionName: data.institution,
      balanceCents: pickBalance(item.balances),
    })

    // Repeated refs within one batch get a suffix so the (source, sourceRef) index stays unique.
    const seen = new Map<string, number>()
    for (const tx of item.transactions) {
      if (tx.status !== 'BOOK') continue
      const currency = tx.transaction_amount.currency.toUpperCase()
      if (currency !== 'EUR') {
        batch.rowErrors.push({ reason: `unknown_currency_no_rate:${currency.toLowerCase()}` })
        continue
      }
      const bookingDate = tx.booking_date ?? tx.value_date ?? tx.transaction_date
      if (!bookingDate) {
        batch.rowErrors.push({ reason: 'invalid_date' })
        continue
      }
      const magnitude = Math.abs(eurosToCents(tx.transaction_amount.amount))
      const amountCents = tx.credit_debit_indicator === 'DBIT' ? -magnitude : magnitude
      const outgoing = amountCents < 0
      const counterparty = (outgoing ? tx.creditor?.name : tx.debtor?.name)?.trim() || undefined
      const counterIban = (outgoing ? tx.creditor_account?.iban : tx.debtor_account?.iban) ?? ''
      const purpose = (tx.remittance_information ?? []).map((line) => line.trim()).filter(Boolean)
      const base = tx.entry_reference?.trim() || bookingHash(tx)
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      batch.transactions.push({
        accountExternalRef: ref,
        sourceRef: count === 0 ? base : `${base}#${count}`,
        bookingDate: bookingDate.slice(0, 10),
        valueDate: tx.value_date?.slice(0, 10) ?? undefined,
        amountCents,
        type: /entgelt/i.test(purpose.join(' ')) ? 'fee' : outgoing ? 'expense' : 'income',
        counterparty,
        counterpartyIban: isValidIban(counterIban) ? normalizeIban(counterIban) : undefined,
        purpose: purpose.join(' · ') || undefined,
      })
    }
  }
  return batch
}
