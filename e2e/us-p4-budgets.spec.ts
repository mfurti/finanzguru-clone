import { expect, test } from '@playwright/test'

/** 003 US4: Budgets page with chart and table (quickstart W9). */
test.describe('003 US4 budgets page', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'changes shared data, runs once')

  test.afterAll(async ({ request }) => {
    const budgets = (await (await request.get('/api/budgets')).json()) as { id: string }[]
    for (const budget of budgets) await request.delete(`/api/budgets/${budget.id}`)
  })

  async function addBudget(page: import('@playwright/test').Page, category: string, euros: string) {
    const empty = page.getByTestId('budget-empty').getByRole('button')
    const add = page.getByTestId('budget-add')
    await expect(empty.or(add)).toBeVisible()
    await ((await add.isVisible()) ? add : empty).click()
    await page.getByTestId('budget-category').click()
    await page.getByRole('option', { name: category, exact: true }).click()
    await page.getByTestId('budget-limit').fill(euros)
    await page.getByTestId('budget-limit').press('Tab')
    await page.getByTestId('budget-save').click()
    await expect(page.getByTestId('budget-modal')).toHaveCount(0)
  }

  test('shows the empty state without budgets', async ({ page, request }) => {
    const budgets = (await (await request.get('/api/budgets')).json()) as { id: string }[]
    for (const budget of budgets) await request.delete(`/api/budgets/${budget.id}`)
    await page.goto('/budget/budgets')
    await expect(page.getByTestId('budget-empty')).toBeVisible()
    await expect(page.getByTestId('budget-chart')).toHaveCount(0)
  })

  test('W9: two budgets add up to the Gesamtbudget; overruns show in red', async ({ page }) => {
    await page.goto('/budget/budgets')
    await addBudget(page, 'Lebenshaltung', '500')
    await addBudget(page, 'Wohnen', '900')
    await expect(page.getByTestId('budget-row')).toHaveCount(2)
    await expect(page.getByTestId('budget-total')).toContainText('1.400,00 €')
    await expect(page.getByTestId('budget-chart').getByTestId('month-bars')).toBeVisible()

    // Lower Wohnen below its spending: the difference turns negative and red.
    const wohnen = page.getByTestId('budget-row').filter({ hasText: 'Wohnen' })
    await wohnen.getByTestId('budget-row-menu').click()
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click()
    await expect(page.getByTestId('budget-limit')).toHaveValue(/900/)
    await page.getByTestId('budget-limit').fill('50')
    await page.getByTestId('budget-limit').press('Tab')
    await page.getByTestId('budget-save').click()
    await expect(wohnen.getByTestId('budget-diff')).toHaveClass(/text-error/)
    await expect(wohnen.getByTestId('budget-diff')).toContainText('-')

    await page.getByTestId('budget-chart-select').click()
    await page.getByRole('option', { name: 'Wohnen' }).click()
    await expect(page.getByTestId('budget-chart').getByTestId('month-bars')).toBeVisible()
  })
})
