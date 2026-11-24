import { expect, test } from '@playwright/test'

/** 003 US5: investments details (quickstart W10). */
test.describe('003 US5 investments', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'table layout checks on desktop')

  test('W10: sort positions, copy ISIN, asset chips', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/investments')
    const table = page.getByTestId('positions-table')
    await page.getByTestId('positions-sort-gain').click()
    await expect(page.getByTestId('positions-sort-gain')).toHaveAttribute('aria-sort', 'descending')
    await page.getByTestId('positions-sort-gain').click()
    await expect(page.getByTestId('positions-sort-gain')).toHaveAttribute('aria-sort', 'ascending')

    await page.getByTestId('positions-sort-name').click()
    const names = await table.locator('tbody tr td:first-child a').allTextContents()
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')))

    await table.locator('tbody tr').first().getByTestId('copy-button').last().click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/^[A-Z]{2}[A-Z0-9]{9}\d$/)

    const totalAll = await page.getByTestId('investments-total').textContent()
    await page.getByTestId('asset-chip-etf').click()
    await expect(table).not.toContainText('Apple Inc.')
    // 004 US2: the chart follows the chips; its total equals the ETF positions.
    await expect(page.getByTestId('performance-asset-class')).toHaveText('ETF')
    const etf = (await (
      await page.request.get('/api/investments/positions?assetClass=etf')
    ).json()) as {
      valueCents: number
    }[]
    const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
    await expect(page.getByTestId('investments-total')).toHaveText(
      euro.format(etf.reduce((sum, row) => sum + row.valueCents, 0) / 100),
    )
    await page.getByTestId('asset-chip-all').click()
    await expect(table).toContainText('Apple Inc.')
    await expect(page.getByTestId('investments-total')).toHaveText(totalAll!)
  })

  test('W10: Wertentwicklung by Zeiträume', async ({ page }) => {
    await page.goto('/investments/analysis')
    await page.getByTestId('returns-view-periods').click()
    await expect(page.getByTestId('trailing-1Y')).toBeVisible()
    await expect(page.getByTestId('trailing-ALL')).not.toContainText('NaN')
  })

  test('W10: dividends by region, calendar grid, Vorabpauschale per broker', async ({ page }) => {
    await page.goto('/investments/dividends')
    await page.getByTestId('dividend-split-region').click()
    const regions = page.getByTestId('dividends-by-region')
    await expect(regions.locator('li').first()).toBeVisible()
    await expect(regions).not.toContainText('NaN')
    await page.getByTestId('calendar-view-grid').click()
    await expect(
      page.getByTestId('calendar-grid').locator('[data-testid^="calendar-cell-"]'),
    ).toHaveCount(12)

    await page.goto('/investments/taxes')
    await expect(
      page.getByTestId('vorabpauschale').locator('[data-testid^="vorab-broker-"]').first(),
    ).toBeVisible()
    await expect(page.getByTestId('vorab-subtotal').first()).not.toContainText('NaN')
  })

  test('bookings: filter panel with count and sortable columns', async ({ page }) => {
    await page.goto('/investments/transactions')
    await page.getByTestId('tx-filter-button').click()
    await page.getByTestId('tx-filter-from').fill('2025-01-01')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('tx-filter-count')).toHaveText('1')
    await page.getByTestId('sort-name').click()
    await expect(page.getByTestId('tx-table').locator('tbody tr').first()).toBeVisible()
  })
})
