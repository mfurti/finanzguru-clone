import { expect, test } from '@playwright/test'

/** 006 US3: create, reorder, switch off and delete rules with preview (quickstart W5). */
test.describe('006 US3 rules management', () => {
  test('create with preview, move up, switch off, delete', async ({ page, request }, info) => {
    const tag = `${info.project.name}-${Date.now() % 100000}`
    // One rule to move past.
    const categories = (await (await request.get('/api/categories')).json()) as {
      children: { id: string }[]
    }[]
    const categoryId = categories.find((main) => main.children.length > 0)!.children[0]!.id
    const first = await request.post('/api/rules', {
      data: {
        matchField: 'counterparty',
        operator: 'contains',
        pattern: `vorher-${tag}`,
        categoryId,
      },
    })
    const firstId = ((await first.json()) as { id: string }).id

    await page.goto('/settings/categories')
    await page.getByTestId('rule-new').click()
    const dialog = page.getByRole('dialog', { name: 'Neue Regel' })
    await dialog.getByTestId('rule-category').click()
    await page.getByRole('option').first().click()
    await dialog.getByTestId('rule-field').click()
    await page.getByRole('option', { name: 'Verwendungszweck' }).click()
    await dialog.getByTestId('rule-pattern').fill(`test-${tag}`)
    await expect(dialog.getByTestId('rule-preview')).toContainText('0 Buchungen würden geändert')
    await dialog.getByTestId('rule-save').click()
    await expect(page.getByText('Regel gespeichert', { exact: true })).toBeVisible()

    const rows = page.getByTestId('rule-row')
    const row = rows.filter({ hasText: `test-${tag}` })
    await expect(row).toContainText('Verwendungszweck enthält')
    const position = async (text: string) =>
      (await rows.allTextContents()).findIndex((line) => line.includes(text))
    const before = await position(`test-${tag}`)
    expect(before).toBeGreaterThan(await position(`vorher-${tag}`))
    await row.getByTestId('rule-up').click()
    await expect.poll(() => position(`test-${tag}`)).toBe(before - 1)

    await row.getByTestId('rule-enabled').click()
    await expect(row).toHaveClass(/opacity-60/)

    await row.getByTestId('rule-delete').click()
    await expect(rows.filter({ hasText: `test-${tag}` })).toHaveCount(0)
    await expect(page.locator('body')).not.toContainText('NaN')
    await request.delete(`/api/rules/${firstId}`)
  })
})
