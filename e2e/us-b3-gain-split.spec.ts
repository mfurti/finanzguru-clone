import { expect, test, type Page } from '@playwright/test'

/**
 * 005 US3: GuV = Realisiert + Kursgewinn on the security page (quickstart W4). The demo depot
 * has a fully sold stock (SAP) and open positions; the partly sold case is pinned by unit tests.
 */
const cents = (text: string) =>
  Math.round(
    Number(
      text
        .replace(/[^\d,+\-−]/g, '')
        .replace('−', '-')
        .replace(',', '.'),
    ) * 100,
  )

async function parts(page: Page) {
  return {
    total: cents((await page.getByTestId('gain-total').textContent())!),
    realized: cents((await page.getByTestId('gain-realized').textContent())!),
    priceGain: cents((await page.getByTestId('gain-price').textContent())!),
  }
}

test.describe('005 US3 gain split', () => {
  test('sold and open securities show both parts adding up to the GuV', async ({ page }) => {
    const sold = (await (
      await page.request.get('/api/investments/positions?status=sold')
    ).json()) as { instrumentId: string }[]
    const open = (await (await page.request.get('/api/investments/positions')).json()) as {
      instrumentId: string
    }[]
    expect(sold.length).toBeGreaterThan(0)

    await page.goto(`/investments/${sold[0]!.instrumentId}`)
    await expect(page.getByTestId('gain-realized')).toBeVisible()
    await expect(page.locator('dl')).toContainText('Realisiert')
    const soldParts = await parts(page)
    expect(soldParts.priceGain).toBe(0)
    expect(soldParts.realized).toBe(soldParts.total)

    await page.goto(`/investments/${open[0]!.instrumentId}`)
    await expect(page.getByTestId('gain-price')).toBeVisible()
    await expect(page.locator('dl')).toContainText('Kursgewinn')
    const openParts = await parts(page)
    expect(openParts.realized + openParts.priceGain).toBe(openParts.total)
    await expect(page.locator('body')).not.toContainText('NaN')
  })
})
