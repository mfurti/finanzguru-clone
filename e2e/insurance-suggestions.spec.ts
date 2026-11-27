import { expect, test } from '@playwright/test'

/**
 * 012 P14: the demo's monthly insurance payments show up as a suggested contract; accepting
 * it creates the contract and removes the suggestion.
 */
test('a recurring insurance booking becomes a contract with one click', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'runs once')
  await page.goto('/insurance')
  const suggestion = page.getByTestId('insurance-suggestion').first()
  await expect(suggestion).toBeVisible()
  const provider = (await suggestion.locator('.font-medium').first().textContent())!.trim()
  await suggestion.getByTestId('insurance-suggestion-accept').click()

  await expect(page.getByTestId('insurance-suggestion').filter({ hasText: provider })).toHaveCount(
    0,
  )
  await expect(page.locator('main')).toContainText(provider)

  // Clean up: remove the created contract again.
  const contracts = (await (await page.request.get('/api/insurance')).json()) as {
    id: string
    provider: string
  }[]
  for (const contract of contracts.filter((row) => row.provider === provider))
    await page.request.delete(`/api/insurance/${contract.id}`)
})
