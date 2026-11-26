import { join } from 'node:path'
import { expect, test } from '@playwright/test'

/**
 * 008 US3 (quickstart L5): upload an own logo for a recipient without brand logo; it shows
 * for all its bookings; a non-image is refused; "Automatisch" removes it again.
 */
test.describe('008 US3 own logo', () => {
  test('L5: upload a PNG, refuse a text file, reset', async ({ page, request }, info) => {
    const name = `Bäckerei Upload ${info.project.name} ${Date.now() % 100000}`
    const accounts = (await (await request.get('/api/accounts')).json()) as {
      id: string
      type: string
    }[]
    const res = await request.post('/api/transactions', {
      data: {
        accountId: accounts.find((acc) => acc.type === 'checking')!.id,
        bookingDate: '2026-11-09',
        amountCents: -350,
        type: 'expense',
        counterparty: name,
      },
    })
    const id = ((await res.json()) as { id: string }).id

    await page.goto(`/transactions?q=${encodeURIComponent(name)}`)
    const row = page.getByTestId('transactions-table').locator('tbody tr').first()
    await row.locator('td').nth(1).click()
    await page.getByTestId('panel-logo').click()
    const picker = page.getByRole('dialog', { name: 'Logo wählen' })

    await picker.getByTestId('logo-file').setInputFiles({
      name: 'notiz.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('kein Bild'),
    })
    await expect(page.getByText('Nur PNG, JPEG oder WebP').first()).toBeVisible()
    await expect(picker).toBeVisible()

    await picker
      .getByTestId('logo-file')
      .setInputFiles(join(import.meta.dirname, 'fixtures', 'logo-64.png'))
    await expect(picker).toHaveCount(0)
    const logo = row.getByTestId('merchant-logo')
    await expect(logo).toHaveAttribute('data-kind', 'upload')
    await expect
      .poll(() => logo.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(64)

    await page.getByTestId('panel-logo').click()
    await page.getByRole('dialog', { name: 'Logo wählen' }).getByTestId('logo-auto').click()
    await expect(row.getByTestId('avatar')).toBeVisible()

    await request.delete(`/api/transactions/${id}`)
  })
})
