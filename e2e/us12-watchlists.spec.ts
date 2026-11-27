import { expect, test } from '@playwright/test'

/** Feature 002, US6: watchlists (quickstart W13) on the demo dataset. */
test.describe('002 US6 Watchlists', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W13: rejects an invalid ISIN, adds one without prices and removes it', async ({ page }) => {
    await page.goto('/investments/watchlists')
    // 012 P10: watchlists are tabs on one page, like the reference.
    await page.getByTestId('watchlist-tab').filter({ hasText: 'Beobachten' }).click()

    const detail = page.getByTestId('watchlist-page')
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

  test('012 P10: new watchlist as a tab with the reference empty state, then deleted', async ({
    page,
  }) => {
    await page.goto('/investments/watchlists')
    await expect(page.getByTestId('watchlist-tab').first()).toBeVisible()
    await page.getByTestId('watchlist-create').click()
    const name = `Leer ${Date.now() % 100000}`
    await page.getByTestId('watchlist-new-name').fill(name)
    await page.getByTestId('watchlist-name-save').click()
    await expect(page.getByTestId('watchlist-tab').filter({ hasText: name })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('watchlist-count')).toHaveText('0 Wertpapiere')
    await expect(page.getByTestId('watchlist-empty')).toContainText('Noch nichts hinzugefügt')
    await expect(page.getByTestId('watchlist-add-first')).toBeVisible()

    await page.getByTestId('watchlist-menu').click()
    await page.getByRole('menuitem', { name: 'Löschen' }).click()
    await expect(page.getByTestId('watchlist-tab').filter({ hasText: name })).toHaveCount(0)
  })
})
