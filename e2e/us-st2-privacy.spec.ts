import { expect, test } from '@playwright/test'

/** 014 US2: privacy mode hides every amount on the dashboard. */
test.describe('014 US2 privacy mode', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'changes shared settings, runs once')
  test.afterEach(async ({ request }) => {
    await request.patch('/api/settings', { data: { privacyMode: false } })
  })

  test('the eye in the header masks all amounts and stays on after reload', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('networth-card')
    await expect(card).toContainText(/\d €/)

    await page.getByTestId('privacy-toggle').click()
    await expect(card).toContainText('•••• €')
    await expect(page.locator('main')).not.toContainText(/\d,\d\d €/)
    await page.reload()
    await expect(page.getByTestId('networth-card')).toContainText('•••• €')
    await expect(page.locator('main')).not.toContainText(/\d,\d\d €/)

    await page.getByTestId('privacy-toggle').click()
    await expect(page.getByTestId('networth-card')).toContainText(/\d,\d\d €/)
  })
})
