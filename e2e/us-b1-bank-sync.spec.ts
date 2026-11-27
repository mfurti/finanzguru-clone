import { expect, test, type Page } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 005 US1: bank card and consent notice with a mocked API (the real bank login needs the owner, T016). */
const csv = {
  id: 'csv',
  kind: 'csv',
  status: 'active',
  displayName: 'CSV-Import',
  lastSyncAt: null,
  lastError: null,
  lastRun: null,
}
const base = {
  id: 'enable_banking',
  kind: 'enable_banking',
  displayName: 'Sparkasse Musterstadt',
  lastError: null,
  lastRun: null,
  dailySync: false,
  institution: 'Sparkasse Musterstadt',
  accounts: [{ id: 'acc-1', name: 'Girokonto …3000', maskedIban: 'DE89 •••• •••• 3000' }],
}
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

async function mockSources(page: Page, bank: Record<string, unknown> | null) {
  await page.route('**/api/sources', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill({ json: bank ? [csv, { ...base, ...bank }] : [csv] })
  })
}

/** Client-side navigation so the mocked `/api/sources` is used (SSR fetches on the server). */
async function openSettings(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('networth-card')).toBeVisible()
  await openSettingsGroup(page, 'sources', 'Datenquellen')
}

test.describe('005 US1 bank card', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'mocked UI states, runs once')

  test('not connected: pick the bank, then the browser goes to the bank login', async ({
    page,
  }) => {
    await mockSources(page, null)
    await page.route('**/api/sources/bank/institutions**', (route) =>
      route.fulfill({
        json: [
          { name: 'Sparkasse Musterstadt', country: 'DE', logo: null },
          { name: 'Testbank', country: 'DE', logo: null },
        ],
      }),
    )
    let body: unknown = null
    await page.route('**/api/sources/bank/connect', (route) => {
      body = route.request().postDataJSON()
      return route.fulfill({ json: { authorizationUrl: 'http://localhost:3200/login-at-bank' } })
    })
    await openSettings(page)
    const card = page.getByTestId('bank-card')
    await expect(card.getByTestId('bank-status')).toHaveText('Nicht verbunden')
    await card.getByTestId('bank-connect').click()
    await page.getByTestId('bank-select').click()
    await page.getByRole('option', { name: 'Sparkasse Musterstadt' }).click()
    await page.getByTestId('bank-connect-confirm').click()
    await expect(page).toHaveURL(/login-at-bank/)
    expect(body).toEqual({ aspspName: 'Sparkasse Musterstadt', aspspCountry: 'DE' })
  })

  test('not configured: the picker explains what is missing', async ({ page }) => {
    await mockSources(page, null)
    await page.route('**/api/sources/bank/institutions**', (route) =>
      route.fulfill({ status: 503, json: { statusCode: 503 } }),
    )
    await openSettings(page)
    await page.getByTestId('bank-card').getByTestId('bank-connect').click()
    await expect(page.getByTestId('bank-not-configured')).toBeVisible()
    await expect(page.getByTestId('bank-connect-confirm')).toBeDisabled()
  })

  test('connected: consent end, warning, accounts; disconnect asks first', async ({ page }) => {
    await mockSources(page, {
      status: 'active',
      lastSyncAt: '2026-11-24T06:00:00.000Z',
      consentEndsAt: inDays(5),
      consentWarning: true,
    })
    let deleted = false
    await page.route('**/api/sources/enable_banking', (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback()
      deleted = true
      return route.fulfill({ status: 204 })
    })
    await openSettings(page)
    const card = page.getByTestId('bank-card')
    await expect(card.getByTestId('bank-status')).toHaveText('Verbunden')
    await expect(card.getByTestId('bank-warning')).toContainText('Tagen ab')
    await expect(card.getByTestId('bank-accounts')).toContainText('DE89 •••• •••• 3000')
    await expect(card.getByTestId('bank-renew')).toBeVisible()
    await card.getByTestId('bank-disconnect').click()
    await page.getByTestId('bank-disconnect-confirm').click()
    await expect(page.getByText('Bankverbindung getrennt', { exact: true })).toBeVisible()
    expect(deleted).toBe(true)
  })
})

test.describe('005 US1 consent notice', () => {
  test('an ended consent shows a notice on other pages with a link to renew', async ({ page }) => {
    await mockSources(page, { status: 'consent_expired', consentEndsAt: inDays(-1) })
    await page.goto('/')
    const notice = page.getByTestId('bank-consent-notice')
    await expect(notice).toContainText('Zugang abgelaufen')
    await notice.getByRole('link', { name: 'Zugang erneuern' }).click()
    await expect(page).toHaveURL(/\/settings\/sources/)
    await expect(page.getByTestId('bank-consent-notice')).toHaveCount(0)
    await expect(page.getByTestId('bank-expired')).toBeVisible()
  })
})
