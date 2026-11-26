import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { formatEur } from '../packages/shared/src/format'

const fixtures = join(import.meta.dirname, '../apps/api/test/fixtures/csv')
const expected = JSON.parse(
  readFileSync(join(import.meta.dirname, '../apps/api/test/fixtures/demo-expected.json'), 'utf8'),
) as { totalCents: number }

async function upload(page: Page, file: string): Promise<void> {
  await page.goto('/settings/sources')
  await page
    .locator('[data-testid="csv-upload"] input[type=file]')
    .setInputFiles(join(fixtures, file))
  await page.getByTestId('csv-upload-button').click()
}

const count = (page: Page, key: 'imported' | 'skipped' | 'failed') =>
  page.getByTestId(`import-${key}`)

// Imports change the shared E2E database, so this journey runs once (desktop project).
test.describe('US2 CSV import', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  // Remove the account the Sparkasse import created, so other journeys see the demo totals again.
  test.afterAll(async ({ request }) => {
    const accounts = (await (await request.get('/api/accounts')).json()) as {
      id: string
      name: string
    }[]
    for (const acc of accounts.filter((item) => item.name.startsWith('Sparkasse Girokonto'))) {
      await request.delete(`/api/accounts/${acc.id}?force=true`)
    }
  })

  test('V1: imports the Sparkasse export and the overview total grows', async ({ page }) => {
    await upload(page, 'sparkasse-camt-v8.csv')
    await expect(page.getByText('Erkanntes Format: sparkasse-camt-v8')).toBeVisible()
    await page.getByTestId('csv-confirm').click()
    await expect(count(page, 'imported')).toHaveText('8')

    await page.goto('/')
    await expect(page.getByTestId('networth-total')).toHaveText(
      formatEur(expected.totalCents + 136777),
    )
  })

  test('V2: re-importing the same file adds nothing', async ({ page }) => {
    await upload(page, 'sparkasse-camt-v8.csv')
    await page.getByTestId('csv-confirm').click()
    await expect(count(page, 'imported')).toHaveText('0')
    await expect(count(page, 'skipped')).toHaveText('8')
  })

  test('V3: malformed rows are reported with line numbers', async ({ page }) => {
    await upload(page, 'malformed.csv')
    await page.getByTestId('csv-confirm').click()
    await expect(page.getByText('Import mit Fehlern abgeschlossen')).toBeVisible()
    await expect(page.getByTestId('import-errors')).toContainText('Zeile 3')
    await expect(page.getByTestId('import-errors')).toContainText('Ungültiger Betrag')
  })

  test('V4: maps an unknown layout once and recognizes it afterwards', async ({ page }) => {
    await upload(page, 'unknown-layout.csv')
    await expect(page.getByTestId('column-mapper')).toBeVisible()
    await page.getByTestId('csv-target').click()
    // Into the account V1 created; afterAll deletes it, so the demo data stays untouched.
    await page.getByRole('option', { name: /Sparkasse Girokonto/ }).click()
    await page.getByTestId('mapping-save-as').fill('Demo-Bank')
    await page.getByTestId('csv-confirm').click()
    await expect(count(page, 'imported')).toHaveText('3')

    await upload(page, 'unknown-layout.csv')
    await expect(page.getByText('Erkanntes Format: mapping:Demo-Bank')).toBeVisible()
    await expect(page.getByTestId('column-mapper')).toHaveCount(0)
    await page.getByTestId('csv-confirm').click()
    await expect(count(page, 'skipped')).toHaveText('3')
  })
})
