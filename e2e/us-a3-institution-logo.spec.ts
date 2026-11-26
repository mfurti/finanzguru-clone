import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * 009 US3 (quickstart A4): on the account detail the owner sets the bank's logo to
 * "Kein Logo", back to "Automatisch", and uploads an own logo for all its accounts.
 */
test.describe('009 US3 institution logo', () => {
  test('A4: Kein Logo, Automatisch, upload', async ({ page, request }, info) => {
    const bank = `Sparkasse Wahltest ${info.project.name} ${Date.now() % 100000}`
    const ids: string[] = []
    for (const name of ['Giro', 'Tagesgeld']) {
      const res = await request.post('/api/accounts', {
        data: { name: `${name} ${bank}`, type: 'checking', institutionName: bank },
      })
      ids.push(((await res.json()) as { id: string }).id)
    }

    await page.goto(`/accounts/${ids[0]}`)
    const logo = page.getByTestId('account-logo')
    await expect(logo.locator('img')).toHaveAttribute('src', /sparkasse\.svg/)

    await page.getByTestId('account-logo-change').click()
    const picker = page.getByRole('dialog', { name: 'Logo wählen' })
    await expect(picker).toContainText(`Gilt für alle Konten von ${bank}`)
    await picker.getByTestId('logo-none').click()
    await expect(logo.locator('img')).toHaveCount(0)

    await page.getByTestId('account-logo-change').click()
    await page.getByRole('dialog', { name: 'Logo wählen' }).getByTestId('logo-auto').click()
    await expect(logo.locator('img')).toHaveAttribute('src', /sparkasse\.svg/)

    await page.getByTestId('account-logo-change').click()
    await page
      .getByRole('dialog', { name: 'Logo wählen' })
      .getByTestId('logo-file')
      .setInputFiles(join(import.meta.dirname, 'fixtures', 'logo-64.png'))
    await expect(logo.locator('img')).toHaveAttribute('src', /\/api\/logos\/files\//)

    // The other account of the same bank shows the upload too.
    await page.goto(`/accounts/${ids[1]}`)
    await expect(page.getByTestId('account-logo').locator('img')).toHaveAttribute(
      'src',
      /\/api\/logos\/files\//,
    )
    await page.getByTestId('account-logo-change').click()
    await page.getByRole('dialog', { name: 'Logo wählen' }).getByTestId('logo-auto').click()
    for (const id of ids) await request.delete(`/api/accounts/${id}`)
  })
})
