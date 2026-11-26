import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * 008 US1 (quickstart L1, L2): brand logos appear automatically, unknown recipients keep
 * initials, no false match on short brand words, and nothing is loaded from other hosts.
 */
async function bookings(request: APIRequestContext, names: string[]): Promise<string[]> {
  const accounts = (await (await request.get('/api/accounts')).json()) as {
    id: string
    type: string
  }[]
  const accountId = accounts.find((acc) => acc.type === 'checking')!.id
  const ids: string[] = []
  for (const counterparty of names) {
    const res = await request.post('/api/transactions', {
      data: {
        accountId,
        bookingDate: '2026-11-07',
        amountCents: -1234,
        type: 'expense',
        counterparty,
      },
    })
    expect(res.ok()).toBe(true)
    ids.push(((await res.json()) as { id: string }).id)
  }
  return ids
}

test.describe('008 US1 brand logos', () => {
  test('L1 + L2: logos, initials and no third-party request', async ({ page, request }, info) => {
    const stamp = `L${info.project.name}${Date.now() % 100000}`
    const names = [
      `REWE Markt GmbH ${stamp}`,
      `PayPal (Europe) ${stamp}`,
      `Bäckerei ${stamp}`,
      `Admiral Spielhalle ${stamp}`,
    ]
    const ids = await bookings(request, names)
    const hosts = new Set<string>()
    page.on('request', (req) => hosts.add(new URL(req.url()).host))

    await page.goto(`/transactions?q=${encodeURIComponent(stamp)}`)
    const rows = page.getByTestId('transactions-table').locator('tbody tr')
    await expect(rows).toHaveCount(4)
    const row = (name: string) => rows.filter({ hasText: name })

    const rewe = row(names[0]!).getByTestId('merchant-logo')
    await expect(rewe).toHaveAttribute('data-kind', 'brand')
    await expect(rewe.locator('img')).toHaveAttribute('src', /\/api\/logos\/brands\/rewe\.svg/)
    await expect
      .poll(() => rewe.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
    await expect(row(names[1]!).getByTestId('merchant-logo').locator('img')).toHaveAttribute(
      'src',
      /paypal\.svg/,
    )
    await expect(row(names[2]!).getByTestId('avatar')).toBeVisible()
    await expect(row(names[3]!).getByTestId('merchant-logo')).toHaveCount(0)

    expect([...hosts].every((host) => host === new URL(page.url()).host)).toBe(true)
    if (info.project.name === 'mobile') {
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    }
    for (const id of ids) await request.delete(`/api/transactions/${id}`)
  })
})
