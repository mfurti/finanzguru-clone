import { expect, test, type Page } from '@playwright/test'

/**
 * 013 R1: the hover line of a chart jumps to the pointer at once (no transition).
 */
async function lineX(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      new Promise<string | null>((resolve) =>
        requestAnimationFrame(() => {
          const line = document.querySelector<SVGLineElement>(
            '[data-testid="networth-card"] g[class*="crosshair"] line, [data-testid="networth-card"] [class*="crosshair"] line',
          )
          resolve(line?.getAttribute('x1') ?? null)
        }),
      ),
  )
}

test('the hover line follows the pointer within one frame', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'pointer test runs once')
  await page.goto('/')
  const chart = page.getByTestId('networth-card').locator('svg').first()
  await expect(chart).toBeVisible()
  const box = (await chart.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2)
  await page.waitForTimeout(300)
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  const next = await lineX(page)
  await page.waitForTimeout(400)
  const settled = await lineX(page)
  expect(settled).not.toBeNull()
  expect(next).toBe(settled)
})
