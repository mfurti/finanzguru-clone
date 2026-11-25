import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ForbiddenToolError } from '../../src/modules/sources/errors'
import {
  decideTool,
  ReadOnlyToolGuard,
  READ_TOOLS,
} from '../../src/modules/sources/scalable-mcp/allowlist'

const allow = new Set(['get_portfolio', 'list_transactions'])

describe('Scalable tool allowlist', () => {
  it('allows exactly the read tools from the real Scalable tool list (004 T006)', () => {
    const tools = (
      JSON.parse(
        readFileSync(join(__dirname, '../fixtures/scalable-mcp/tools-list.json'), 'utf8'),
      ) as { tools: { name: string; description?: string; annotations?: object }[] }
    ).tools
    const allowed = tools.filter((tool) => decideTool(tool).allowed).map((tool) => tool.name)
    expect(allowed.sort()).toEqual([...READ_TOOLS].sort())
    for (const name of [
      'get_trade_request_status',
      'list_savings_plans',
      'add_watchlist_item',
      'create_price_alert',
      'remove_portfolio_group',
      'list_order_venues',
      'get_transaction_details',
    ]) {
      expect(allowed, name).not.toContain(name)
    }
  })

  it('allows the market-data read tools for the watchlist (005 T024)', () => {
    const tools = (
      JSON.parse(
        readFileSync(join(__dirname, '../fixtures/scalable-mcp/tools-list.json'), 'utf8'),
      ) as { tools: { name: string; description?: string; annotations?: object }[] }
    ).tools
    for (const name of ['search_securities', 'get_security_quote', 'get_security_chart']) {
      const tool = tools.find((item) => item.name === name)!
      expect(decideTool(tool), name).toMatchObject({ allowed: true })
    }
    expect(
      tools.filter((tool) => /order/i.test(tool.name)).some((t) => decideTool(t).allowed),
    ).toBe(false)
  })

  it('matches risky words in descriptions only as whole words', () => {
    const allow = new Set(['get_cash'])
    expect(
      decideTool({ name: 'get_cash', description: 'cash and buying-power breakdown' }, allow)
        .allowed,
    ).toBe(true)
    expect(
      decideTool({ name: 'get_cash', description: 'can place a sell order' }, allow).reason,
    ).toBe('denied_pattern')
  })

  it('allows only allowlisted tools without risky words', () => {
    expect(decideTool({ name: 'get_portfolio', description: 'Positions and cash' }, allow)).toEqual(
      {
        name: 'get_portfolio',
        allowed: true,
        reason: 'allowlisted',
      },
    )
    expect(decideTool({ name: 'get_quotes' }, allow).reason).toBe('not_allowlisted')
  })

  it.each([
    'place_order',
    'cancel_order',
    'create_trade',
    'buy_security',
    'sell_security',
    'transfer_cash',
    'update_savings_plan',
    'withdraw',
  ])('denies %s even when allowlisted', (name) => {
    expect(decideTool({ name }, new Set([name])).reason).toBe('denied_pattern')
  })

  it('denies tools whose description mentions orders or that are not read-only', () => {
    expect(
      decideTool({ name: 'list_transactions', description: 'Places a market order' }, allow)
        .allowed,
    ).toBe(false)
    expect(
      decideTool({ name: 'list_transactions', annotations: { readOnlyHint: false } }, allow).reason,
    ).toBe('not_read_only')
  })

  it('never sends blocked calls to the transport', async () => {
    const client = { callTool: vi.fn().mockResolvedValue({ content: [] }) }
    const guard = new ReadOnlyToolGuard(
      client,
      [{ name: 'get_portfolio' }, { name: 'place_order', description: 'Buy or sell' }],
      new Set(['get_portfolio', 'place_order']),
    )
    await expect(guard.call('place_order', { isin: 'X' })).rejects.toBeInstanceOf(
      ForbiddenToolError,
    )
    await expect(guard.call('unknown_tool')).rejects.toBeInstanceOf(ForbiddenToolError)
    expect(client.callTool).not.toHaveBeenCalled()

    await guard.call('get_portfolio')
    expect(client.callTool).toHaveBeenCalledWith({ name: 'get_portfolio', arguments: {} })
  })
})
