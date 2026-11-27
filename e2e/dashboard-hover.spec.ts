import { expect, test } from '@playwright/test'

/** 013 R2: dashboard cards keep their look on hover, like every other page. */
test('dashboard cards keep their look on hover', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'pointer test runs once')
  await page.goto('/')
  const card = page.getByTestId('dashboard').locator('> *').first()
  await expect(card).toBeVisible()
  const before = await card.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.backgroundColor, s.boxShadow, s.transform].join('|')
  })
  await card.hover()
  await page.waitForTimeout(400)
  const after = await card.evaluate((el) => {
    const s = getComputedStyle(el)
    return [s.backgroundColor, s.boxShadow, s.transform].join('|')
  })
  expect(after).toBe(before)
})
