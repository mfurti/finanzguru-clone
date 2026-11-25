import { expect, test } from '@playwright/test'
import { chooseCategory } from './helpers'

// Categorizing and budgets change the shared E2E database, so this journey runs once.
test.describe('US5 budget', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test.afterAll(async ({ request }) => {
    const budgets = (await (await request.get('/api/budgets')).json()) as { id: string }[]
    for (const budget of budgets) await request.delete(`/api/budgets/${budget.id}`)
  })

  test('V9: switches month, quarter and year and steps back', async ({ page }) => {
    await page.goto('/budget')
    const label = page.getByTestId('period-label')
    await expect(label).toHaveText(/\w+ \d{4}/)
    await page.getByTestId('granularity').getByRole('tab', { name: 'Quartal' }).click()
    await expect(label).toHaveText(/^Q[1-4] \d{4}$/)
    await page.getByTestId('granularity').getByRole('tab', { name: 'Jahr' }).click()
    await expect(label).toHaveText(/^\d{4}$/)
    const year = Number(await label.textContent())
    await page.getByTestId('period-prev').click()
    await expect(label).toHaveText(String(year - 1))
    await expect(page.getByTestId('tile-income')).not.toHaveText('0,00 €')
    // The Sankey has its own page since 003 (Analyse | Sankey | Budgets).
    await page.goto('/budget/sankey')
    await expect(page.getByTestId('sankey')).toBeVisible()
  })

  test('V10: categorizes an unreviewed booking and the count drops', async ({ page, request }) => {
    const before = (
      (await (await request.get('/api/transactions/unreviewed/count')).json()) as { count: number }
    ).count
    expect(before).toBeGreaterThan(0)
    // The review list moved to Übersicht › Transaktionen (003): old link redirects there.
    await page.goto('/budget/review')
    await expect(page).toHaveURL(/\/transactions\?review=unreviewed/)
    await page.getByTestId('category-chip').first().click()
    // 007: one large window (list, scope, "merken"); default is this booking only.
    const dialog = await chooseCategory(page, 'Lebenshaltung › Lebensmittel und Getränke')
    await dialog.getByTestId('category-change-save').click()
    await expect(page.getByTestId('unreviewed-count')).toHaveText(String(before - 1))
    const after = (
      (await (await request.get('/api/transactions/unreviewed/count')).json()) as { count: number }
    ).count
    expect(after).toBeLessThan(before)
  })

  test('V11: a budget for Lebenshaltung shows up on the overview', async ({ page }) => {
    await page.goto('/budget/budgets')
    // Since 003 budgets are added in a dialog ("Hinzufügen").
    await page.getByTestId('budget-empty').getByRole('button').click()
    await page.getByTestId('budget-category').click()
    await page.getByRole('option', { name: 'Lebenshaltung', exact: true }).click()
    await page.getByTestId('budget-limit').fill('500')
    await page.getByTestId('budget-limit').press('Tab')
    await page.getByTestId('budget-save').click()
    await expect(page.getByTestId('budget-list')).toContainText('Lebenshaltung')

    await page.goto('/')
    await expect(page.getByTestId('budgets-card')).toContainText('Lebenshaltung')
    await expect(page.getByTestId('budgets-card')).toContainText('500,00 €')
  })
})
