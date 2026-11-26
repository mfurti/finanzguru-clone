import { expect, test } from '@playwright/test'

/**
 * 012 P3: switching between the Übersicht pages keeps the side navigation mounted (same
 * element), like Investments and Budget; only the page content changes.
 */
test('Übersicht side navigation stays mounted between its pages', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'side navigation is desktop only')
  await page.goto('/')
  const nav = page.getByTestId('section-nav')
  await expect(nav).toBeVisible()
  await nav.evaluate((element) => element.setAttribute('data-mark', 'kept'))

  await nav.getByTestId('section-nav-accounts').click()
  await expect(page).toHaveURL(/\/accounts$/)
  await expect(page.getByTestId('section-nav')).toHaveAttribute('data-mark', 'kept')

  await page.getByTestId('section-nav').getByTestId('section-nav-transactions').click()
  await expect(page).toHaveURL(/\/transactions/)
  await expect(page.getByTestId('transactions-table')).toBeVisible()
  await expect(page.getByTestId('section-nav')).toHaveAttribute('data-mark', 'kept')

  await page.getByTestId('section-nav').getByTestId('section-nav-dashboard').click()
  await expect(page.getByTestId('dashboard')).toBeVisible()
  await expect(page.getByTestId('section-nav')).toHaveAttribute('data-mark', 'kept')
  await expect(page.getByTestId('customize-open')).toBeVisible()
})
