import { expect, test } from '@playwright/test'

/**
 * 007 US5 (quickstart W7): "+ Hinzufügen" opens one large window; "Sparkasse" leads to
 * "Wie möchtest du importieren?" and "Datei hochladen" to the CSV upload.
 */
test.describe('007 US5 add from one large window', () => {
  test('W7: Sparkasse → import methods → CSV upload', async ({ page }, info) => {
    await page.goto('/')
    await page.getByTestId('add-menu').click()
    const dialog = page.getByRole('dialog', { name: 'Was möchtest du hinzufügen?' })
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('add-search').fill('Spark')
    await dialog.getByTestId('add-provider-sparkasse').click()
    await expect(dialog.getByTestId('add-how')).toContainText('Wie möchtest du importieren?')
    for (const label of ['Automatisch', 'Datei hochladen', 'Manuell']) {
      await expect(dialog).toContainText(label)
    }
    if (info.project.name === 'mobile') {
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    }
    await dialog.getByTestId('add-method-file').click()
    await expect(page).toHaveURL(/\/settings\/sources#csv/)
    await expect(page.locator('#csv')).toBeVisible()
  })

  test('Assets tab opens the account form', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('add-menu').click()
    const dialog = page.getByRole('dialog', { name: 'Was möchtest du hinzufügen?' })
    await dialog.getByRole('tab', { name: 'Assets' }).click()
    await dialog.getByRole('button', { name: 'Konto anlegen' }).click()
    await expect(page.getByRole('dialog', { name: 'Konto anlegen' })).toBeVisible()
  })
})
