import { expect, test } from '@playwright/test'

test.describe('US4 investments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/investments')
    await expect(page.getByTestId('positions-table')).toBeVisible()
  })

  test('filters by asset class', async ({ page }) => {
    const table = page.getByTestId('positions-table')
    await expect(table).toContainText('Apple Inc.')
    await page.getByTestId('asset-chip-etf').click()
    await expect(table).not.toContainText('Apple Inc.')
    await expect(table).toContainText('MSCI World')
  })

  test('hides a column and exports only visible columns', async ({ page, request }) => {
    // 012 P2: the "Spalten" side panel; changes apply on "Speichern".
    await page.getByTestId('columns-menu').click()
    await page.getByTestId('columns-toggle-dividends').click()
    await page.getByTestId('columns-save').click()
    await expect(page.getByTestId('positions-table').locator('th')).not.toContainText(['Dividende'])

    const href = await page.getByTestId('positions-export').getAttribute('href')
    expect(href).not.toContain('dividends')
    const csv = await (await request.get(href!)).text()
    const header = csv.replace(/^\uFEFF/, '').split('\r\n')[0]!
    expect(header).toContain('Aktueller Wert')
    expect(header).not.toContain('Dividende')
  })

  test('opens a position and shows sold investments', async ({ page }) => {
    await page.getByTestId('sold-toggle').click()
    await expect(page.getByTestId('sold-list')).toContainText('SAP SE')

    await page.getByRole('link', { name: 'Apple Inc.' }).first().click()
    await expect(page.getByTestId('instrument-name')).toHaveText('Apple Inc.')
    await expect(page.getByTestId('instrument-position')).toContainText('Aktueller Wert')
  })

  test('has no horizontal page scroll', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
