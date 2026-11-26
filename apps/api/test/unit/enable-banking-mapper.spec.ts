import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  Balance,
  BankTransaction,
  SessionAccount,
} from '../../src/modules/sources/enable-banking/client'
import {
  accountType,
  bankRef,
  mapBankData,
  pickBalance,
  type BankData,
} from '../../src/modules/sources/enable-banking/mapper'

/** Fixtures in the documented response shape (005 T009); public example IBANs only. */
const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(join(__dirname, '../fixtures/enable-banking', `${name}.json`), 'utf8'),
  ) as T

function data(): BankData {
  const page1 = fixture<{ transactions: BankTransaction[] }>('transactions.page1')
  const page2 = fixture<{ transactions: BankTransaction[] }>('transactions.page2')
  return {
    institution: 'Sparkasse Musterstadt',
    accounts: [
      {
        uid: '00000000-0000-4000-8000-0000000000a1',
        details: fixture<SessionAccount>('details'),
        balances: fixture<{ balances: Balance[] }>('balances').balances,
        transactions: [...page1.transactions, ...page2.transactions],
      },
    ],
  }
}

describe('Enable Banking mapper (005 T009)', () => {
  it('creates a checking account with IBAN, name and the booked balance', () => {
    const batch = mapBankData(data())
    expect(batch.accounts).toEqual([
      {
        externalRef: bankRef('00000000-0000-4000-8000-0000000000a1'),
        name: 'Sparkasse Musterstadt Girokonto …3000',
        type: 'checking',
        iban: 'DE89370400440532013000',
        institutionName: 'Sparkasse Musterstadt',
        balanceCents: 123456,
      },
    ])
  })

  it('imports booked entries only, with signs, counterparties and purposes', () => {
    const batch = mapBankData(data())
    expect(batch.transactions.map((t) => [t.sourceRef, t.amountCents, t.type])).toEqual([
      ['ref-001', 250000, 'income'],
      ['ref-002', -5499, 'expense'],
      [expect.stringMatching(/^h:[0-9a-f]{32}$/), -495, 'fee'],
    ])
    expect(batch.transactions[0]).toMatchObject({
      bookingDate: '2026-11-01',
      counterparty: 'Arbeitgeber GmbH',
      counterpartyIban: 'DE02120300000000202051',
      purpose: 'Gehalt November',
    })
    expect(batch.transactions[1]!.purpose).toBe('Kartenzahlung · Filiale 12')
    expect(batch.rowErrors).toEqual([{ reason: 'unknown_currency_no_rate:usd' }])
  })

  it('gives the same hash ref on every sync and keeps repeated refs unique', () => {
    const first = mapBankData(data()).transactions[2]!.sourceRef
    expect(mapBankData(data()).transactions[2]!.sourceRef).toBe(first)
    const input = data()
    const twin = input.accounts[0]!.transactions.find((t) => t.entry_reference === 'ref-002')!
    input.accounts[0]!.transactions.push({ ...twin })
    const refs = mapBankData(input).transactions.map((t) => t.sourceRef)
    expect(refs).toContain('ref-002#1')
    expect(new Set(refs).size).toBe(refs.length)
  })

  it('prefers the booked closing balance and ignores foreign currencies', () => {
    const eur = (amount: string, type: string): Balance => ({
      balance_amount: { amount, currency: 'EUR' },
      balance_type: type,
    })
    expect(pickBalance([eur('1', 'ITAV'), eur('2', 'CLBD')])).toBe(200)
    expect(pickBalance([eur('3.005', 'OTHR')])).toBe(300)
    expect(
      pickBalance([{ balance_amount: { amount: '9', currency: 'USD' }, balance_type: 'CLBD' }]),
    ).toBeUndefined()
  })
})

describe('Enable Banking mapper on recorded Sparkasse responses (005 T008, anonymized)', () => {
  const real = <T>(name: string): T => fixture<T>(`real/${name}`)
  const transactions = real<{ transactions: BankTransaction[] }>('transactions.page1').transactions
  const batch = mapBankData({
    institution: 'Sparkasse Musterstadt',
    accounts: [
      {
        uid: '00000000-0000-4000-8000-0000000000b1',
        details: real<SessionAccount>('details'),
        balances: real<{ balances: Balance[] }>('balances').balances,
        transactions,
      },
    ],
  })

  it('names the account by product, never by the holder name', () => {
    expect(batch.accounts[0]!.name).toBe('Sparkasse Musterstadt Giro Trend …3000')
    expect(batch.accounts[0]!.name).not.toContain('MUSTERMANN')
  })

  it('imports every booked entry with a unique ref and the posting text first', () => {
    expect(batch.rowErrors).toEqual([])
    expect(batch.transactions).toHaveLength(transactions.filter((t) => t.status === 'BOOK').length)
    expect(new Set(batch.transactions.map((t) => t.sourceRef)).size).toBe(batch.transactions.length)
    const card = batch.transactions.find((t) => t.purpose?.startsWith('KARTENZAHLUNG'))
    expect(card).toMatchObject({ type: 'expense' })
    expect(card!.amountCents).toBeLessThan(0)
    expect(batch.transactions.some((t) => t.type === 'income')).toBe(true)
  })

  it('takes the booked closing balance', () => {
    const clbd = real<{ balances: Balance[] }>('balances').balances.find(
      (b) => b.balance_type === 'CLBD',
    )!
    expect(batch.accounts[0]!.balanceCents).toBe(
      Math.round(Number(clbd.balance_amount.amount) * 100),
    )
  })
})

describe('account types from cash_account_type (005)', () => {
  it('maps savings and card accounts; anything else is checking', () => {
    expect(accountType({ uid: 'a', cash_account_type: 'SVGS' })).toBe('savings')
    expect(accountType({ uid: 'a', cash_account_type: 'CARD' })).toBe('credit_card')
    expect(accountType({ uid: 'a', cash_account_type: 'CACC' })).toBe('checking')
    expect(accountType({ uid: 'a' })).toBe('checking')
  })
})
