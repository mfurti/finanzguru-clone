import { describe, expect, it } from 'vitest'
import {
  accountsParam,
  createAccountInput,
  createTransactionInput,
  isoDate,
  rangeQuery,
} from '../src/index'

describe('shared schemas', () => {
  it('accepts real calendar dates only', () => {
    expect(isoDate.safeParse('2026-02-28').success).toBe(true)
    expect(isoDate.safeParse('2026-02-30').success).toBe(false)
    expect(isoDate.safeParse('28.02.2026').success).toBe(false)
  })

  it('splits the accounts query parameter', () => {
    expect(accountsParam.parse('a, b,,c')).toEqual(['a', 'b', 'c'])
    expect(accountsParam.parse(undefined)).toBeUndefined()
  })

  it('defaults the period and rejects from > to', () => {
    expect(rangeQuery.parse({}).period).toBe('1Y')
    expect(rangeQuery.safeParse({ from: '2026-05-01', to: '2026-04-01' }).success).toBe(false)
  })

  it('normalizes IBAN input and defaults the institution', () => {
    const parsed = createAccountInput.parse({
      name: 'Giro',
      type: 'checking',
      iban: 'de89 3704 0044 0532 0130 00',
    })
    expect(parsed.iban).toBe('DE89370400440532013000')
    expect(parsed.institutionName).toBe('Manuell')
  })

  it('requires ISIN and quantity for buy transactions', () => {
    const result = createTransactionInput.safeParse({
      accountId: 'a',
      bookingDate: '2026-11-20',
      amountCents: -10000,
      type: 'buy',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['isin', 'quantity'])
  })
})
