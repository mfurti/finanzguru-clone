import { expect, test } from '@playwright/test'

/** 003 US6: dashboard refinements (quickstart W11, first half). */
test.describe('003 US6 dashboard', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'changes chart settings, runs once')

  test.afterAll(async ({ request }) => {
    const current = await (await request.get('/api/settings/charts')).json()
    await request.put('/api/settings/charts', { data: { ...current, networthShowInvested: true } })
  })

  test('custom range: tabs inactive, range shown as text', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('networth-card')
    await card.getByTestId('range-picker').click()
    await page.getByTestId('range-from').fill('2026-03-01')
    await page.getByTestId('range-to').fill('2026-06-30')
    await page.getByTestId('range-apply').click()
    await expect(card.getByTestId('range-picker')).toContainText('01.03.2026 – 30.06.2026')
    await expect(card.getByRole('tab', { selected: true })).toHaveCount(1) // Vermögen/Rendite only
    await expect(card.getByTestId('networth-total')).not.toContainText('NaN')
  })

  test('menu hides "Investiertes Kapital" and remembers it after reload', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('networth-menu').click()
    await page.getByRole('menuitemcheckbox', { name: 'Investiertes Kapital' }).click()
    await page.keyboard.press('Escape')
    await expect
      .poll(
        async () =>
          (await (await page.request.get('/api/settings/charts')).json()).networthShowInvested,
      )
      .toBe(false)
    await page.reload()
    await page.getByTestId('networth-menu').click()
    await expect(
      page.getByRole('menuitemcheckbox', { name: 'Investiertes Kapital' }),
    ).toHaveAttribute('aria-checked', 'false')
  })

  test('unreviewed card links to the filtered transactions', async ({ page }) => {
    await page.goto('/')
    const card = page.getByTestId('review-banner')
    test.skip((await card.count()) === 0, 'no unreviewed bookings left')
    // 007: one-line tile with the count, no list of bookings.
    await expect(card.getByTestId('review-count')).toHaveText(/^\d[\d.]*$/)
    await card.getByRole('link').click()
    await expect(page).toHaveURL(/\/transactions\?review=unreviewed/)
  })
})
