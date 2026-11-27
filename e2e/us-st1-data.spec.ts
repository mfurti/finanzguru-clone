import { expect, test } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 014 US1: backup download and CSV export in Einstellungen › Daten. */
test.describe('014 US1 data settings', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'downloads, runs once')

  test('downloads a backup zip and the bookings CSV', async ({ page }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'data', 'Daten')
    await expect(page.getByTestId('demo-data-card')).toBeVisible()

    const backup = page.waitForEvent('download')
    await page.getByTestId('backup-download').click()
    expect((await backup).suggestedFilename()).toMatch(/^vermoegenskompass-backup-.*\.zip$/)

    const csv = page.waitForEvent('download')
    await page.getByTestId('csv-export').click()
    expect((await csv).suggestedFilename()).toBe('transaktionen.csv')
  })
})
