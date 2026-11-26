import { expect, test } from '@playwright/test'
import { PAGES } from './pages'

/**
 * Every page of the production build hydrates without a mismatch (server and client render
 * the same tree). Dev-only mismatches, such as a template comment between v-if and v-else,
 * do not show here because the build strips comments.
 */
test('all pages hydrate without mismatch', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport is enough')
  test.setTimeout(120_000)
  const problems: string[] = []
  page.on('console', (message) => {
    if (/hydration/i.test(message.text()))
      problems.push(`${page.url()}: ${message.text().split('\n')[0]}`)
  })
  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  expect(problems).toEqual([])
})
