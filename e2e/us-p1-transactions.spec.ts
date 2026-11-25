import { expect, test } from '@playwright/test'

/** 003 US1: Übersicht › Transaktionen as the bookings workspace (quickstart W1–W5). */
test.describe('003 US1 transactions workspace', () => {
  test.describe.configure({ mode: 'serial' })
  // Changes the shared E2E database, so the journey runs once.
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  const unreviewed = async (request: import('@playwright/test').APIRequestContext) =>
    ((await (await request.get('/api/transactions/unreviewed/count')).json()) as { count: number })
      .count

  test('W1: "Nur ungeprüfte anzeigen" shows exactly the unreviewed rows', async ({
    page,
    request,
  }) => {
    const count = await unreviewed(request)
    await page.goto('/transactions')
    await expect(page.getByTestId('unreviewed-count')).toHaveText(String(count))
    await page.getByTestId('only-unreviewed').click()
    await expect(page).toHaveURL(/review=unreviewed/)
    await expect(page.getByTestId('transactions-table').locator('tbody tr')).toHaveCount(
      Math.min(count, 50),
    )
    await expect(page.getByTestId('unreviewed-dot')).toHaveCount(Math.min(count, 50))
  })

  test('W2: bulk category on two rows lowers the count by two', async ({ page, request }) => {
    const before = await unreviewed(request)
    test.skip(before < 2, 'needs two unreviewed bookings')
    await page.goto('/transactions?review=unreviewed')
    const rows = page.getByTestId('select-row')
    await rows.nth(0).click()
    await rows.nth(1).click()
    await expect(page.getByTestId('bulk-bar')).toContainText('2 ausgewählt')
    await page.getByTestId('bulk-category').click()
    await page.getByRole('option', { name: 'Lebenshaltung › Lebensmittel und Getränke' }).click()
    // 006: the change goes through the dialog (scope, "merken"); default is this booking only.
    await page.getByTestId('category-change-save').click()
    await expect(page.getByTestId('unreviewed-count')).toHaveText(String(before - 2))
    expect(await unreviewed(request)).toBe(before - 2)
  })

  test('W2b: the category chip changes one booking in place', async ({ page }) => {
    await page.goto('/transactions?q=Demo%20Modehaus')
    const chip = page.getByTestId('category-chip').first()
    await chip.click()
    await page.getByRole('option', { name: 'Gesundheit und Wellness', exact: true }).first().click()
    await page.getByTestId('category-change-save').click()
    await expect(chip).toContainText('Gesundheit und Wellness')
  })

  test('W3: delete with undo brings the booking back', async ({ page }) => {
    await page.goto('/transactions?sort=date&dir=desc')
    const label = page.getByTestId('rows-label')
    const total = Number((await label.textContent())!.match(/von (\d+)/)![1])
    const firstRow = page.getByTestId('transactions-table').locator('tbody tr').first()
    await firstRow.hover()
    await firstRow.getByTestId('delete-row').click()
    await expect(label).toContainText(`von ${total - 1}`)
    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(label).toContainText(`von ${total}`)
  })

  test('W4: export has the visible columns and filtered rows only', async ({ page }) => {
    await page.goto('/transactions?types=expense&from=2026-10-01&to=2026-10-31')
    await page.getByTestId('columns-menu').click()
    await page.getByRole('menuitemcheckbox', { name: 'Konto' }).click()
    await page.keyboard.press('Escape')
    const href = await page.getByTestId('transactions-export').getAttribute('href')
    expect(href).toContain('types=expense')
    expect(href).not.toContain('account')
    const csv = await (await page.request.get(href!)).text()
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('Datum;Name;Verwendungszweck;Kategorie;Tags;Betrag')
    const total = Number(
      (await page.getByTestId('rows-label').textContent())!.match(/von (\d+)/)![1],
    )
    expect(lines).toHaveLength(total + 1)
  })

  test('W5: the old review page redirects to the unreviewed filter', async ({ page }) => {
    await page.goto('/budget/review')
    await expect(page).toHaveURL(/\/transactions\?review=unreviewed/)
    await expect(page.getByTestId('only-unreviewed')).toBeVisible()
  })

  test('filter panel counts active filters', async ({ page }) => {
    await page.goto('/transactions')
    await page.getByTestId('filter-button').click()
    await page.getByTestId('filter-from').fill('2026-09-01')
    await page.getByTestId('filter-to').fill('2026-09-30')
    await page.getByTestId('filter-apply').click()
    await expect(page).toHaveURL(/from=2026-09-01/)
    await expect(page.getByTestId('filter-count')).toHaveText('1')
  })
})
