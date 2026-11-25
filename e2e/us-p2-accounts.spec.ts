import { expect, test } from '@playwright/test'

/** 003 US2: Portfolios & Konten with detail pages (quickstart W6). */
test.describe('003 US2 accounts', () => {
  test('W6: copy the IBAN and open the account detail with only its bookings', async ({
    page,
    context,
    browserName,
  }) => {
    await page.goto('/accounts')
    await expect(page.getByTestId('account-group-depot')).toBeVisible()
    const giro = page.getByTestId('account-row').filter({ hasText: 'Demo Girokonto' })
    await expect(giro.getByTestId('sparkline')).toBeVisible({
      visible: test.info().project.name === 'desktop',
    })
    if (test.info().project.name === 'desktop' && browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await expect(giro.getByTestId('iban-masked')).toHaveText(/^DE\d{2} •••• •••• \d{4}$/)
      await giro.getByTestId('copy-button').click()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      expect(copied).toMatch(/^DE\d{20}$/)
      await expect(page).toHaveURL(/\/accounts$/)
    }

    await giro.getByText('Demo Girokonto').click()
    await expect(page).toHaveURL(/\/accounts\/[\w-]+$/)
    await expect(page.getByTestId('account-detail')).toContainText('Demo Girokonto')
    await expect(page.getByTestId('account-figures')).not.toContainText('NaN')
    const accounts = page.getByTestId('transactions-table').locator('tbody tr td:nth-child(6)')
    if (test.info().project.name === 'desktop') {
      // Since 007 Konto is an optional column, off by default.
      await page.getByTestId('columns-menu').click()
      await page.getByRole('menuitemcheckbox', { name: 'Konto' }).click()
      await page.keyboard.press('Escape')
      await expect(accounts.first()).toHaveText('Demo Girokonto')
      const texts = await accounts.allTextContents()
      expect(new Set(texts)).toEqual(new Set(['Demo Girokonto']))
    }
  })

  test('depot detail shows positions of that depot', async ({ page }) => {
    await page.goto('/accounts')
    await page.getByTestId('account-group-depot').getByText('Demo Depot').click()
    await expect(page).toHaveURL(/\/depots\/[\w-]+$/)
    await expect(page.getByTestId('positions-card')).toBeVisible()
    await expect(page.getByTestId('positions-table')).toContainText('MSCI')
  })

  test('"+" on the Depots card opens the form with type Depot', async ({ page }) => {
    await page.goto('/accounts')
    await page.getByTestId('account-group-add-depot').click()
    await expect(page.getByRole('dialog')).toContainText('Depot')
  })
})
