import { expect, test } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 014 US1: backup download and CSV export in Einstellungen › Daten. */
test.describe('014 US1 data settings', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'downloads, runs once')

  test('downloads a backup, stages and cancels its restore, exports the bookings CSV', async ({
    page,
  }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'data', 'Daten')
    await expect(page.getByTestId('demo-data-card')).toBeVisible()

    const backup = page.waitForEvent('download')
    await page.getByTestId('backup-download').click()
    const zip = await backup
    expect(zip.suggestedFilename()).toMatch(/^vermoegenskompass-backup-.*\.zip$/)

    // Restore: staged only after confirming, then cancelled again (the e2e data stays).
    await page.getByTestId('restore-file').setInputFiles(await zip.path())
    await page.getByTestId('restore-confirm').click()
    await expect(page.getByTestId('restore-pending')).toContainText('Neustart nötig')
    await page.getByTestId('restore-pending').getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByTestId('restore-pending')).toHaveCount(0)

    const csv = page.waitForEvent('download')
    await page.getByTestId('csv-export').click()
    expect((await csv).suggestedFilename()).toBe('transaktionen.csv')
  })
})
