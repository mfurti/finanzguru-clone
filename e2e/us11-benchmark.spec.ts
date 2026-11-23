import { expect, test } from '@playwright/test'

/** Feature 002, US5: "Vergleichen mit" (quickstart W12) on the demo dataset. */
test.describe('002 US5 Vergleichen mit', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W12: benchmark line in the Rendite view, remembered after reload', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('networth-card')
    await card.getByRole('tab', { name: 'Rendite' }).click()

    const select = card.getByTestId('benchmark-select')
    await select.getByRole('combobox').click()
    await page.getByRole('option', { name: 'iShares Core S&P 500 UCITS ETF (Acc)' }).click()
    await expect(card.getByTestId('benchmark-legend')).toContainText('S&P 500')

    await page.reload()
    await card.getByRole('tab', { name: 'Rendite' }).click()
    await expect(card.getByTestId('benchmark-legend')).toContainText('S&P 500')

    // Clean up: back to no benchmark.
    await card.getByTestId('benchmark-select').getByRole('combobox').click()
    await page.getByRole('option', { name: 'Keiner' }).click()
    await expect(card.getByTestId('benchmark-legend')).toBeHidden()
  })
})
