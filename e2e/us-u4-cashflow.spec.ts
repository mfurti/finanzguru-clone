import { expect, test } from '@playwright/test'

/**
 * 007 US4 (quickstart W6): Budget › Analyse with boxed figures, two-line month labels,
 * Sankey card with link and the category donut labelled "Gesamtausgaben".
 */
test.describe('007 US4 cash-flow charts like the reference', () => {
  test('W6: figures, month axis, Sankey card and donut', async ({ page }, info) => {
    await page.goto('/budget')
    await expect(page.getByTestId('summary-tiles')).toBeVisible()
    await expect(page.getByTestId('tile-income')).not.toContainText('NaN')

    // Year as second line at the first bar or January.
    const ticks = page.getByTestId('cashflow-bars').locator('text')
    await expect(ticks.filter({ hasText: /20\d\d/ }).first()).toBeAttached()

    const sankey = page.getByTestId('sankey-card')
    await expect(sankey).toBeVisible()
    await expect(sankey.locator('svg').first()).toBeVisible()
    const box = (await sankey.boundingBox())!
    expect(box.height).toBeLessThan(620)
    await expect(page.getByTestId('donut-center-label')).toHaveText('Gesamtausgaben')

    if (info.project.name === 'mobile') {
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    }

    await sankey.getByTestId('sankey-open').click()
    await expect(page).toHaveURL(/\/budget\/sankey/)
  })
})
