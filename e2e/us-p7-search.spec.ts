import { expect, test } from '@playwright/test'

/** 003 US7: global search (quickstart W11, second half). */
test.describe('003 US7 global search', () => {
  test('Ctrl+K, "Giro" and Enter open the account', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('networth-card')).toBeVisible()
    await page.keyboard.press('Control+k')
    const input = page
      .getByRole('combobox')
      .or(page.getByPlaceholder('Seiten, Wertpapiere, Konten, Buchungen …'))
    await input.first().fill('Giro')
    await expect(page.getByRole('option', { name: /Demo Girokonto/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/accounts\/[\w-]+$/)
  })

  test('magnifier: a booking hit opens the filtered transactions', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('search-open').click()
    await page.getByPlaceholder('Seiten, Wertpapiere, Konten, Buchungen …').fill('Hausverwaltung')
    await page
      .getByRole('option', { name: /Hausverwaltung/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/transactions\?q=Hausverwaltung/)
  })

  test('shows "Keine Treffer" for unknown terms', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('search-open').click()
    await page.getByPlaceholder('Seiten, Wertpapiere, Konten, Buchungen …').fill('kein-treffer-xyz')
    await expect(page.getByTestId('search-palette')).toContainText('Keine Treffer')
  })
})
