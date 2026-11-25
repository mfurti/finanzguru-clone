import { expect, test } from '@playwright/test'

/** 005 US2: asset-class chips add lines; headline and table stay on "Alle" (quickstart W4). */
test.describe('005 US2 class chart', () => {
  test('chips add legend lines in € and %, headline unchanged', async ({ page }) => {
    await page.goto('/investments')
    const card = page.getByTestId('performance-card')
    const total = await card.getByTestId('investments-total').textContent()
    const rows = await page.getByTestId('positions-table').locator('tbody tr').count()
    const chips = card.getByTestId('class-chips')
    await expect(chips).toBeVisible()
    const enabled = chips.locator(
      '[data-testid^="class-chip-"]:not([data-testid="class-chip-all"]):enabled',
    )
    expect(await enabled.count()).toBeGreaterThan(1)
    await enabled.nth(0).click()
    await enabled.nth(1).click()
    await expect(card.getByTestId('class-legend').locator('li')).toHaveCount(3)
    await expect(card.getByTestId('investments-total')).toHaveText(total!)
    await card.getByRole('button', { name: '%', exact: true }).click()
    await expect(card.getByTestId('class-legend').locator('li')).toHaveCount(3)
    await expect(card).not.toContainText('NaN')
    await expect(page.getByTestId('positions-table').locator('tbody tr')).toHaveCount(rows)
    await card.getByTestId('class-chip-all').click()
    await expect(card.getByTestId('class-legend')).toHaveCount(0)
  })
})
