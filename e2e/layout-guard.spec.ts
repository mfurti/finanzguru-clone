import { expect, test, type Page } from '@playwright/test'
import { PAGES } from './pages'

/**
 * 010 US3 layout guard (quickstart Q4, Q5): every page at phone, tablet and desktop width –
 * no page-level horizontal scroll, booking tables fit, positions and investment bookings fit
 * on desktop, a table that has to scroll keeps its first column fixed, and all dropdowns on a
 * page have one height (US4).
 */
const WIDTHS = [375, 768, 1440]

/** Tables that must fit their box at the given minimum width. */
const MUST_FIT: Record<string, { testId: string; from: number }[]> = {
  '/transactions': [{ testId: 'transactions-table', from: 0 }],
  '/budget/sankey': [{ testId: 'transactions-table', from: 0 }],
  '/investments': [{ testId: 'positions-table', from: 1440 }],
  '/investments/transactions': [{ testId: 'tx-table', from: 768 }],
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const tables = [...document.querySelectorAll('main table')].map((table) => {
      const box = table.parentElement!
      const first = table.querySelector('tbody tr td, thead th')
      return {
        testId: table.closest('[data-testid]')?.getAttribute('data-testid') ?? '',
        overflow: table.scrollWidth - box.clientWidth,
        visible: (table as HTMLElement).offsetParent !== null,
        firstSticky: first ? getComputedStyle(first).position === 'sticky' : false,
      }
    })
    // Select/dropdown triggers (010 US4): one height per page.
    const controlHeights = [
      ...new Set(
        [...document.querySelectorAll('main [role=combobox]')]
          .map((element) => Math.round(element.getBoundingClientRect().height))
          .filter((height) => height > 0),
      ),
    ]
    return {
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      tables,
      controlHeights,
    }
  })
}

test.describe('010 layout guard', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'sets its own widths')

  for (const width of WIDTHS) {
    test(`all pages fit at ${width} px`, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width, height: 900 })
      const problems: string[] = []
      for (const path of PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const result = await measure(page)
        if (result.pageOverflow > 1)
          problems.push(`${path}: page scrolls sideways (+${result.pageOverflow})`)
        if (result.controlHeights.length > 1)
          problems.push(`${path}: dropdown heights ${result.controlHeights.join('/')} px`)
        for (const rule of MUST_FIT[path] ?? []) {
          if (width < rule.from) continue
          const table = result.tables.find((item) => item.testId === rule.testId && item.visible)
          if (table && table.overflow > 1)
            problems.push(`${path}: ${rule.testId} +${table.overflow} px`)
        }
        for (const table of result.tables) {
          if (!table.visible || table.overflow <= 1) continue
          const allowedToScroll = !(MUST_FIT[path] ?? []).some(
            (rule) => rule.testId === table.testId && width >= rule.from,
          )
          if (allowedToScroll && !table.firstSticky && table.testId !== 'transactions-table') {
            problems.push(
              `${path}: ${table.testId || 'table'} scrolls without a fixed first column`,
            )
          }
        }
      }
      expect(problems).toEqual([])
    })
  }

  test('booking amount is visible on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await page.goto('/transactions')
    const amount = page
      .getByTestId('transactions-table')
      .locator('tbody tr')
      .first()
      .locator('td')
      .last()
    await expect(amount).toBeInViewport({ ratio: 1 })
  })
})
