import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * No layout shift from popups (owner request 2026-11-25): opening a modal, side panel or menu
 * must not narrow the page (scroll lock vs. scrollbar gutter), and selecting a booking must
 * not push the rows down (floating bulk bar).
 */
async function rect(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) }
}

/**
 * Measures `target` with the pointer already on `trigger` (scrolled into view, hover lift
 * done), then opens the popup and closes it with Escape.
 */
async function expectStable(page: Page, target: Locator, trigger: Locator) {
  await trigger.scrollIntoViewIfNeeded()
  await trigger.hover()
  await page.waitForTimeout(300)
  const before = await rect(target)
  await trigger.click()
  await page.waitForTimeout(400)
  expect(await rect(target)).toEqual(before)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

test.describe('layout stays put when popups open', () => {
  test('transactions: filter, columns, side panel, category window, add window, selection', async ({
    page,
  }) => {
    await page.goto('/transactions')
    const table = page.getByTestId('transactions-table')
    const row = table.locator('tbody tr').nth(2)
    await expect(row).toBeVisible()

    await expectStable(page, row, page.getByTestId('filter-button'))
    await expectStable(page, row, page.getByTestId('columns-menu'))
    await expectStable(page, row, table.locator('tbody tr').first().locator('td').nth(1))
    await expectStable(page, row, page.getByTestId('category-chip').first())
    await expectStable(page, row, page.getByTestId('add-menu'))

    const checkbox = table.getByTestId('select-row').first()
    await checkbox.hover()
    const before = await rect(row)
    await checkbox.click()
    await expect(page.getByTestId('bulk-bar')).toBeVisible()
    expect(await rect(row)).toEqual(before)
    await checkbox.click()
    await expect(page.getByTestId('bulk-bar')).toHaveCount(0)
  })

  test('overview: customize window and chart menu', async ({ page }) => {
    await page.goto('/')
    // The container, not a card: cards lift 2 px on hover (card-hover), which ends when an
    // overlay covers them; that is the hover effect, not a layout shift.
    const dashboard = page.getByTestId('dashboard')
    await expect(page.getByTestId('networth-card')).toBeVisible()
    await expectStable(page, dashboard, page.getByTestId('customize-open'))
    await expectStable(page, dashboard, page.getByTestId('networth-menu'))
  })
})
