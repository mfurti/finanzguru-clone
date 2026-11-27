import { expect, test } from '@playwright/test'

/**
 * 012 P12: the budget categories donut uses the room of its card (up to 400 px) at desktop
 * width, while the dashboard donut keeps the shared 176 px look.
 */
test('categories donut fills its card on desktop, dashboard donut stays compact', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'widths are set here')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/budget')
  const donut = page.getByTestId('category-donut').getByTestId('donut-chart')
  await expect(donut).toBeVisible()
  await expect.poll(async () => (await donut.boundingBox())!.width).toBeGreaterThanOrEqual(300)

  await page.goto('/')
  const dashboard = page.getByTestId('donut-chart').first()
  await expect(dashboard).toBeVisible()
  expect((await dashboard.boundingBox())!.width).toBeLessThan(200)
})
