import { describe, expect, it, vi } from 'vitest'
import { ForbiddenToolError } from '../../src/modules/sources/errors'
import {
  decideTool,
  ReadOnlyToolGuard,
  READ_TOOLS,
} from '../../src/modules/sources/scalable-mcp/allowlist'

const allow = new Set(['get_portfolio', 'list_transactions'])

describe('Scalable tool allowlist', () => {
  it('is empty until the real tool list is known, so nothing is callable', () => {
    expect(READ_TOOLS.size).toBe(0)
    expect(decideTool({ name: 'get_portfolio' }).allowed).toBe(false)
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
