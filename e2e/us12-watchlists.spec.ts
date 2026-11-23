import { expect, test } from '@playwright/test'

/** Feature 002, US6: watchlists (quickstart W13) on the demo dataset. */
test.describe('002 US6 Watchlists', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W13: rejects an invalid ISIN, adds one without prices and removes it', async ({ page }) => {
    await page.goto('/investments/watchlists')
    await page.getByTestId('watchlist-list').getByRole('link', { name: 'Beobachten' }).click()

    const detail = page.getByTestId('watchlist-detail')
    const entries = detail.getByTestId('watchlist-entries')
    await expect(entries).toContainText('iShares Core S&P 500 UCITS ETF (Acc)')
    await expect(entries).toContainText('%')
    await detail.getByRole('tab', { name: '5J' }).click()
    await expect(entries).toContainText('€')

    const form = detail.getByTestId('watchlist-add')
    await form.getByTestId('watchlist-isin').fill('IE00B5BMR088')
    await form.getByTestId('watchlist-name').fill('Falsch')
    await expect(form).toContainText('Ungültige ISIN')
    await expect(form.getByTestId('watchlist-add-submit')).toBeDisabled()

    await form.getByTestId('watchlist-isin').fill('IE00BK5BQT80')
    await form.getByTestId('watchlist-name').fill('Vanguard FTSE All-World (Acc)')
    await form.getByTestId('watchlist-add-submit').click()
    const row = entries.getByRole('listitem').filter({ hasText: 'Vanguard FTSE All-World (Acc)' })
    await expect(row.getByTestId('watchlist-no-prices')).toContainText('Keine Kurse')

    await row.getByTestId('watchlist-remove').click()
    await expect(row).toBeHidden()
  })
})
