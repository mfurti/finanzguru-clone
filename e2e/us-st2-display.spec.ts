import { expect, test } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 014 US2: start page and table density from Einstellungen › Anzeige. */
test.describe('014 US2 display settings', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'changes shared settings, runs once')
  test.afterEach(async ({ request }) => {
    await request.patch('/api/settings', { data: { startPage: 'dashboard', density: 'normal' } })
  })

  test('start page opens Budget on a new visit; the Übersicht stays reachable', async ({
    page,
    browser,
  }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'display', 'Anzeige')
    await page.getByTestId('setting-start-page').click()
    await page.getByRole('option', { name: 'Budget' }).click()
    await expect(page.getByTestId('setting-start-page')).toHaveText(/Budget/)

    const visit = await browser.newPage({ storageState: 'e2e/.auth/owner.json' })
    await visit.goto('/')
    await expect(visit).toHaveURL(/\/budget$/)
    await visit.getByTestId('main-tabs').getByRole('link', { name: 'Übersicht' }).click()
    await expect(visit).toHaveURL(/\/$/)
    await visit.close()
  })

  test('compact density tightens the tables', async ({ page }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'display', 'Anzeige')
    await page.getByTestId('setting-density').click()
    await page.getByRole('option', { name: 'Kompakt' }).click()
    await expect(page.locator('html')).toHaveClass(/density-compact/)
    await page.goto('/transactions')
    await expect(page.locator('html')).toHaveClass(/density-compact/)
  })
})
