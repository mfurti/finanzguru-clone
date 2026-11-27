import { expect, test } from '@playwright/test'

/**
 * 013 US2: "Aktualisieren" left of "Anpassen" on the Übersicht with the data state. The e2e
 * API has no connected source, so the button is disabled and the newest booking is shown.
 */
test('Übersicht shows Aktualisieren and the data state', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'header layout is checked once')
  await page.goto('/')
  const refresh = page.getByTestId('refresh-all')
  await expect(refresh).toBeVisible()
  await expect(refresh).toBeDisabled()
  await expect(page.getByTestId('data-state')).toContainText('Letzte Buchung:')
  // Left of "Anpassen".
  const customize = page.getByTestId('customize-open')
  expect((await refresh.boundingBox())!.x).toBeLessThan((await customize.boundingBox())!.x)
})
