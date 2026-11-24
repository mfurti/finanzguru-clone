import { expect, test, type Page } from '@playwright/test'

/** 004 US1: Scalable card states with a mocked API (the real login needs the owner, T006/T012). */
const base = {
  id: 'scalable_mcp',
  kind: 'scalable_mcp',
  displayName: 'Scalable Capital',
  lastError: null,
  dailySync: false,
}

/** Client-side navigation so the mocked `/api/sources` is used (SSR fetches on the server). */
async function openSettings(page: Page) {
  await page.goto('/')
  await expect(page.getByTestId('networth-card')).toBeVisible()
  await page.locator('a[href="/settings/sources"]').first().click()
  await expect(page).toHaveURL(/\/settings\/sources/)
}

async function mockSources(page: Page, scalable: Record<string, unknown> | null) {
  await page.route('**/api/sources', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const csv = {
      id: 'csv',
      kind: 'csv',
      status: 'active',
      displayName: 'CSV-Import',
      lastSyncAt: null,
      lastError: null,
      lastRun: null,
    }
    await route.fulfill({ json: scalable ? [csv, { ...base, ...scalable }] : [csv] })
  })
}

test.describe('004 US1 Scalable card', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'mocked UI states, runs once')

  test('not connected: "Scalable Capital verbinden" goes to Scalable’s login page', async ({
    page,
  }) => {
    await mockSources(page, null)
    await page.route('**/api/sources/scalable/connect', (route) =>
      route.fulfill({
        json: { connected: false, authorizationUrl: 'http://localhost:3200/login-at-scalable' },
      }),
    )
    await openSettings(page)
    const card = page.getByTestId('scalable-card')
    await expect(card.getByTestId('scalable-status')).toHaveText('Nicht verbunden')
    await card.getByTestId('scalable-connect').click()
    await expect(page).toHaveURL(/login-at-scalable/)
  })

  test('connected: shows the last sync and refuses a parallel sync', async ({ page }) => {
    await mockSources(page, {
      status: 'active',
      lastSyncAt: '2026-11-24T06:00:00.000Z',
      lastRun: {
        status: 'succeeded',
        imported: 12,
        skipped: 3,
        finishedAt: '2026-11-24T06:00:05Z',
      },
    })
    await page.route('**/api/sources/scalable_mcp/sync', (route) =>
      route.fulfill({ status: 409, json: { statusCode: 409, statusMessage: 'läuft' } }),
    )
    await openSettings(page)
    const card = page.getByTestId('scalable-card')
    await expect(card.getByTestId('scalable-status')).toHaveText('Verbunden')
    await expect(card.getByTestId('scalable-last-sync')).toContainText('12 neu, 3 übersprungen')
    await expect(card.getByTestId('scalable-daily')).toContainText('aus')
    await card.getByTestId('scalable-sync').click()
    await expect(page.getByText('Synchronisierung läuft bereits', { exact: true })).toBeVisible()
  })

  test('expired grant: offers "Neu verbinden"; disconnect asks first', async ({ page }) => {
    await mockSources(page, {
      status: 'needs_reauth',
      lastSyncAt: null,
      lastRun: null,
      lastError: 'Anmeldung abgelaufen – bitte neu verbinden',
    })
    let deleted = false
    await page.route('**/api/sources/scalable_mcp', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleted = true
        return route.fulfill({ status: 204 })
      }
      return route.fallback()
    })
    await openSettings(page)
    const card = page.getByTestId('scalable-card')
    await expect(card.getByTestId('scalable-status')).toHaveText('Neu verbinden')
    await expect(card.getByTestId('scalable-connect')).toHaveText('Neu verbinden')
    await card.getByTestId('scalable-disconnect').click()
    await page.getByTestId('scalable-disconnect-confirm').click()
    await expect.poll(() => deleted).toBe(true)
  })
})
