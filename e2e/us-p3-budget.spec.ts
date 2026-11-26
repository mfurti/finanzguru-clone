import { expect, test } from '@playwright/test'

/** 003 US3: budget area like the reference (quickstart W7–W8). */
test.describe('003 US3 budget area', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W7: month dropdown, Sankey click filters the bookings', async ({ page }) => {
    await page.goto('/budget/sankey')
    await expect(page.getByTestId('period-current')).toBeDisabled()
    await page.getByTestId('period-picker').click()
    await page.getByTestId('period-options').getByRole('option', { name: 'September 2026' }).click()
    await expect(page.getByTestId('period-label')).toHaveText('September 2026')
    await expect(page.getByTestId('period-range')).toHaveText('01.09. – 30.09.')
    await expect(page.getByTestId('period-current')).toBeEnabled()

    const wohnen = page.locator('[data-testid="sankey-node"][data-node^="main:"]').filter({
      hasText: 'Wohnen',
    })
    // The chart is drawn by ECharts; its blocks are selected via the keyboard block list (011).
    await wohnen.focus()
    await wohnen.press('Enter')
    const table = page.getByTestId('transactions-table')
    await expect(table.locator('tbody tr').first()).toBeVisible()
    const dates = await table.locator('tbody tr td:nth-child(3)').allTextContents()
    expect(dates.every((d) => d.endsWith('.09.2026'))).toBe(true)
    const categories = await table.locator('tbody tr td:nth-child(4)').allTextContents()
    expect(categories.every((c) => /Miete|Strom|Wohn/.test(c))).toBe(true)

    // Selecting again clears the filter.
    await wohnen.press('Enter')
    await expect
      .poll(async () => (await table.locator('tbody tr td:nth-child(4)').allTextContents()).join())
      .not.toMatch(/^(Miete|Strom|Wohn)[^,]*(,(Miete|Strom|Wohn)[^,]*)*$/)
  })

  test('chevron opens the category detail with history and bookings', async ({ page }) => {
    await page.goto('/budget')
    await page.locator('li > button[data-testid^="category-"]').first().click()
    await expect(page).toHaveURL(/\/budget\/categories\/[\w-]+/)
    await expect(page.getByTestId('category-detail')).toBeVisible()
    await expect(page.getByTestId('month-bars').locator('svg > rect').first()).toBeVisible()
    await expect(page.getByTestId('category-detail-total')).not.toContainText('NaN')
  })

  test('W8: icon and color chosen in settings are saved for every view', async ({ page }) => {
    await page.goto('/settings/categories')
    const tree = page.getByTestId('category-tree')
    const main = tree.locator('button[data-testid^="appearance-"]').first()
    const id = (await main.getAttribute('data-testid'))!.replace('appearance-', '')
    await main.click()
    await page.getByTestId('swatch-rose').click()
    await page.getByTestId('icon-sofa').click()
    await page.keyboard.press('Escape')

    const res = await page.request.get('/api/categories')
    const node = ((await res.json()) as { id: string; color: string; icon: string }[]).find(
      (c) => c.id === id,
    )!
    expect(node).toMatchObject({ color: 'rose', icon: 'sofa' })
  })
})
