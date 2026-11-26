import { expect, test } from '@playwright/test'

/** Section navigation: sidebar on wide screens, dropdown below 1024 px (like the reference). */
test.describe('section navigation', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'sets its own viewports')

  test('sidebar on wide screens marks the active view and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/investments')
    const nav = page.getByTestId('section-nav')
    await expect(nav).toBeVisible()
    await expect(page.getByTestId('section-nav-menu')).toBeHidden()
    await expect(nav.getByTestId('section-nav-positions')).toHaveAttribute('aria-current', 'page')

    await nav.getByTestId('section-nav-dividends').click()
    await expect(page).toHaveURL(/\/investments\/dividends/)
    await expect(nav.getByTestId('section-nav-dividends')).toHaveAttribute('aria-current', 'page')
  })

  test('dropdown below 1024 px shows the current view and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await page.goto('/budget')
    await expect(page.getByTestId('section-nav')).toBeHidden()
    const menu = page.getByTestId('section-nav-menu')
    await expect(menu).toHaveText(/Analyse/)

    await menu.click()
    await page.getByRole('menuitem', { name: 'Budgets' }).click()
    await expect(page).toHaveURL(/\/budget\/budgets/)
    await expect(page.getByTestId('section-nav-menu')).toHaveText(/Budgets/)
  })

  test('Übersicht has Dashboard, Portfolios & Konten and Transaktionen', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await page.goto('/')
    const menu = page.getByTestId('section-nav-menu')
    await expect(menu).toHaveText(/Dashboard/)
    await menu.click()
    await page.getByRole('menuitem', { name: 'Transaktionen' }).click()
    await expect(page).toHaveURL(/\/transactions$/)
    await expect(page.getByTestId('bookings')).toBeVisible()

    await page.getByTestId('section-nav-menu').click()
    await page.getByRole('menuitem', { name: 'Portfolios & Konten' }).click()
    await expect(page).toHaveURL(/\/accounts$/)
    await expect(page.getByTestId('account-group-account')).toBeVisible()
  })
})
