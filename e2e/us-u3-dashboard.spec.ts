import { expect, test, type Page } from '@playwright/test'

/**
 * 007 US3 (quickstart W5): chart header in one row, card order like the reference in two
 * columns at 1440 px, one column without horizontal scroll at 360 px.
 */
async function top(page: Page, testId: string): Promise<number> {
  return (await page.getByTestId(testId).first().boundingBox())!.y
}

test.describe('007 US3 dashboard like the reference', () => {
  test('W5: header row and two columns at 1440 px', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'width set here')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    // Tabs left and period tabs right in the same row.
    const header = page.getByTestId('networth-header')
    const tabs = (await header.getByRole('tab').first().boundingBox())!
    const menu = (await page.getByTestId('networth-menu').boundingBox())!
    expect(Math.abs(tabs.y + tabs.height / 2 - (menu.y + menu.height / 2))).toBeLessThan(12)
    expect(menu.x).toBeGreaterThan(tabs.x + 600)

    const left = page.getByTestId('dashboard-left')
    const right = page.getByTestId('dashboard-right')
    await expect(left.getByTestId('allocation-card')).toBeVisible()
    await expect(left.getByTestId('kpi-card')).toBeVisible()
    await expect(left.getByTestId('holdings-card')).toBeVisible()
    await expect(right.getByTestId('accounts-card')).toBeVisible()
    await expect(right.getByTestId('cashflow-card')).toBeVisible()
    const l = (await left.boundingBox())!
    const r = (await right.boundingBox())!
    expect(r.x).toBeGreaterThan(l.x + l.width - 1)
    expect(await top(page, 'allocation-card')).toBeLessThan(await top(page, 'kpi-card'))
    expect(await top(page, 'kpi-card')).toBeLessThan(await top(page, 'holdings-card'))
    expect(await top(page, 'accounts-card')).toBeLessThan(await top(page, 'cashflow-card'))

    // Card titles are links with "›".
    await expect(
      page.getByTestId('holdings-card').getByRole('link', { name: 'Holdings' }),
    ).toHaveAttribute('href', '/investments')
  })

  test('W8: one column at 360 px without horizontal scroll', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', '360 px project')
    await page.goto('/')
    await expect(page.getByTestId('networth-card')).toBeVisible()
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(360)
    const allocation = (await page.getByTestId('allocation-card').boundingBox())!
    const accounts = (await page.getByTestId('accounts-card').boundingBox())!
    expect(Math.abs(allocation.x - accounts.x)).toBeLessThan(2)
    expect(await top(page, 'allocation-card')).toBeLessThan(await top(page, 'accounts-card'))
    await expect(page.locator('body')).not.toContainText('NaN')
  })
})
