import { expect, test } from '@playwright/test'

/**
 * Hovering the ECharts Sankey must not throw (011 fix): ECharts animates label colours on
 * hover and failed on CSS colours such as oklch(…) from the theme tokens.
 */
test('hovering the Sankey raises no page error', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport is enough')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/budget/sankey')
  const chart = page.getByTestId('sankey-chart')
  await expect(chart.locator('svg').first()).toBeVisible()
  const box = (await chart.boundingBox())!
  // Sweep a grid over the whole chart so the pointer crosses blocks, flows and labels.
  for (let y = 0.05; y < 1; y += 0.1) {
    for (let x = 0.01; x < 1; x += 0.07) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y)
      await page.waitForTimeout(60)
    }
  }
  await page.mouse.move(0, 0)
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})
