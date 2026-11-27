import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { CashflowSummary, TaxYearDto, VorabpauschaleResponse } from '@finance/shared'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { capitalGainsTax } from '../../src/domain/capital-gains-tax'
import { createDemoApp } from '../helpers/demo-app'

/** 014 T010: assessment default, church tax and the purchases rule from the owner settings. */
describe('Finanzen & Steuern settings (014)', () => {
  let app: NestFastifyApplication
  let cookie: string
  const year = new Date().getFullYear()

  beforeAll(async () => {
    ;({ app, cookie } = await createDemoApp())
  })

  afterAll(async () => {
    await app?.close()
  })

  afterEach(async () => {
    await settings({ assessmentDefault: 'single', churchTax: 'none', purchasesCountAsSaved: true })
  })

  const get = async <T>(url: string): Promise<T> => {
    const res = await app.inject({ method: 'GET', url, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return res.json() as T
  }
  const settings = (payload: object) =>
    app.inject({ method: 'PATCH', url: '/api/settings', headers: { cookie }, payload })

  it('years without own settings use the default assessment', async () => {
    expect((await get<TaxYearDto>('/api/taxes/2019')).allowanceCents).toBe(100_000)
    await settings({ assessmentDefault: 'joint' })
    const joint = await get<TaxYearDto>('/api/taxes/2019')
    expect(joint.assessment).toBe('joint')
    expect(joint.allowanceCents).toBe(200_000)
  })

  it('church tax raises the estimated tax on the Vorabpauschale', async () => {
    const url = `/api/taxes/${year - 1}/vorabpauschale`
    const without = await get<VorabpauschaleResponse>(url)
    expect(without.churchTaxRate).toBe('0')
    expect(without.estimatedTaxCents).toBe(
      capitalGainsTax(without.totalTaxableCents, '0').totalCents,
    )

    await settings({ churchTax: 'BY' })
    const bavaria = await get<VorabpauschaleResponse>(url)
    expect(bavaria.churchTaxRate).toBe('0.08')
    expect(bavaria.estimatedTaxCents).toBe(
      capitalGainsTax(bavaria.totalTaxableCents, '0.08').totalCents,
    )
    if (bavaria.totalTaxableCents > 1000)
      expect(bavaria.estimatedTaxCents).toBeGreaterThan(without.estimatedTaxCents)
  })

  it('purchases leave "Gespart" when they do not count as saved', async () => {
    const url = `/api/cashflow/summary?granularity=year&anchor=${year}-06-01`
    const counted = await get<CashflowSummary>(url)
    await settings({ purchasesCountAsSaved: false })
    const notCounted = await get<CashflowSummary>(url)
    expect(notCounted.savedCents).toBeLessThan(counted.savedCents)
    expect(notCounted.expenseCents).toBeLessThan(counted.expenseCents)
    // Income stays the same: only the purchases leave the budget.
    expect(notCounted.incomeCents).toBe(counted.incomeCents)
  })
})
