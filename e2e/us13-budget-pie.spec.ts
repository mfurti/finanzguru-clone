import { expect, test } from '@playwright/test'

/** Feature 002, US7: budget pie chart (quickstart W14) on the demo dataset. */
test.describe('002 US7 Budget-Kreisdiagramm', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W14: % shares add up to 100 and hover links slice and row', async ({ page }) => {
    await page.goto('/budget')
    const list = page.getByTestId('category-list')
    await expect(list.getByTestId('category-donut')).toBeVisible()

    await list.getByTestId('category-unit-pct').click()
    // Category rows only (not the total row, tabs or the €/% switch).
    const rows = list.locator('li > button[data-testid^="category-"]')
    const texts = await rows.allTextContents()
    const shares = texts
      .map((text) => /(\d+,\d+) %/.exec(text)?.[1])
      .filter((value): value is string => !!value)
      .map((value) => Number(value.replace(',', '.')))
    expect(shares.length).toBeGreaterThan(0)
    expect(Math.abs(shares.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(0.1)

    // Hovering a slice highlights its list row.
    // The ring sweeps in on load, so dispatch the event instead of a pointer hover.
    await list.getByTestId('donut-slice').first().dispatchEvent('mouseenter')
    await expect(list.locator('[data-hovered]')).toHaveCount(1)
    await expect(list.getByTestId('donut-center-label')).not.toHaveText('Gesamt')
  })
})
