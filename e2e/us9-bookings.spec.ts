import { expect, test } from '@playwright/test'

/** Feature 002, US3: bookings table (quickstart W8–W9) on the demo dataset. */
test.describe('002 US3 Buchungen', () => {
  test('W8: filters, hides a column and exports exactly the visible table', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'desktop layout')
    await page.goto('/investments/transactions')
    const table = page.getByTestId('tx-table')
    await expect(table).toBeVisible()

    await page.getByTestId('tx-filter-button').click()
    await page.getByTestId('tx-filter-type').click()
    await page.getByRole('option', { name: 'Kauf', exact: true }).click()
    await page.getByTestId('tx-filter-security').click()
    await page.getByRole('option', { name: 'iShares Core MSCI World UCITS ETF (Acc)' }).click()
    await page.keyboard.press('Escape')
    if (await page.getByTestId('tx-filters').isVisible()) {
      await page.getByTestId('tx-filter-button').click()
    }
    await expect(page.getByTestId('tx-filters')).toBeHidden()
    await expect(table.locator('tbody tr').first()).toContainText('Kauf')

    const api = await (
      await page.request.get(
        '/api/investments/transactions?type=buy&pageSize=200&instrumentId=' +
          new URL(
            (await page.getByTestId('tx-export').getAttribute('href'))!,
            'http://x',
          ).searchParams.get('instrumentId'),
      )
    ).json()
    const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
    await expect(page.getByTestId('tx-sum')).toContainText(
      euro.format(api.sumCents / 100).replace('-', ''),
    )

    await page.getByTestId('tx-columns-menu').click()
    await page.getByRole('menuitemcheckbox', { name: 'Steuern' }).click()
    await page.keyboard.press('Escape')
    await expect(table.locator('thead')).not.toContainText('Steuern')

    const href = (await page.getByTestId('tx-export').getAttribute('href'))!
    const csv = await (await page.request.get(href)).text()
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n')
    expect(lines[0]).not.toContain('Steuern')
    expect(lines[0]).toContain('Gesamtbetrag')
    expect(lines).toHaveLength(1 + api.total)
  })

  test('W9: cards instead of a table on phones, no horizontal scroll', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'phone layout')
    await page.goto('/investments/transactions')
    await expect(page.getByTestId('tx-cards')).toBeVisible()
    await expect(page.getByTestId('tx-table')).toBeHidden()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
