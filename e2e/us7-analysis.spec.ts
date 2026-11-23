import { expect, test } from '@playwright/test'

/** Feature 002, US1: Analyse page (quickstart W1–W5) on the demo dataset. */
test.describe('002 US1 Analyse', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W1/W5: breakdowns by region, sector and own grouping', async ({ page }) => {
    await page.goto('/investments/analysis')
    const card = page.getByTestId('breakdown-card')
    await expect(card.getByTestId('breakdown-list')).toContainText('ETF')

    await card.getByRole('tab', { name: 'Regionen' }).click()
    await expect(card.getByTestId('breakdown-list')).toContainText('Nordamerika')
    await expect(card.getByTestId('breakdown-list')).toContainText('Schwellenländer')

    await card.getByRole('tab', { name: 'Branchen' }).click()
    await expect(card.getByTestId('breakdown-list')).toContainText('Nicht zugeordnet')

    await card.getByRole('tab', { name: 'Eigene Aufteilung' }).click()
    await expect(card.getByTestId('breakdown-list')).toContainText('Kern')
    await expect(card.getByTestId('breakdown-list')).toContainText('Satellit')
  })

  test('W3/W4: heatmap, yearly table and depot comparison', async ({ page }) => {
    await page.goto('/investments/analysis')
    const returns = page.getByTestId('returns-card')
    await returns.getByRole('tab', { name: 'Heatmap' }).click()
    await expect(returns.getByTestId('return-heatmap')).toBeVisible()
    await expect(returns.getByTestId('yearly-table')).toContainText('YTD')
    await expect(page.getByTestId('compare-card')).toContainText('Demo Depot')
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  test('W2: weights above 100 % cannot be saved', async ({ page }) => {
    await page.goto('/investments')
    await page
      .getByRole('link', { name: 'iShares Core MSCI World UCITS ETF (Acc)' })
      .first()
      .click()
    const form = page.getByTestId('classification-form')
    await expect(form.getByTestId('sum-region')).toContainText('Summe 100 %')

    const first = form.getByTestId('weight-pct-region-0')
    await first.fill('84')
    await first.press('Tab')
    await expect(form.getByTestId('sum-region')).toContainText('Summe 110 % – höchstens 100 %')
    await expect(form.getByTestId('classification-save')).toBeDisabled()
  })
})
