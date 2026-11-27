import { expect, test } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 014: settings area with its own navigation. */
test.describe('014 settings frame', () => {
  test('gear opens the settings, the navigation switches groups', async ({ page }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'categories', 'Kategorien & Regeln')
    await expect(page.getByRole('heading', { level: 1, name: 'Kategorien & Regeln' })).toBeVisible()
    await openSettingsGroup(page, 'inflation', 'Inflation')
    await expect(page.getByRole('heading', { level: 1, name: 'Inflation' })).toBeVisible()
  })
})
