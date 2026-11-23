import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { describe, expect, it, vi } from 'vitest'
import {
  AuthExpiredError,
  ForbiddenToolError,
  UpstreamError,
} from '../../src/modules/sources/errors'
import { ScalableMcpClient } from '../../src/modules/sources/scalable-mcp/client'
import type { ScalableOAuthProvider } from '../../src/modules/sources/scalable-mcp/oauth-provider'

const provider = () => ({ pendingAuthorizationUrl: null }) as unknown as ScalableOAuthProvider
const URL_ = new URL('https://mcp.example/mcp')

/** Fake Scalable server: one read tool, one order tool. */
async function fakeServer(onOrder = vi.fn()) {
  const server = new McpServer({ name: 'fake-scalable', version: '1.0.0' })
  server.registerTool('get_portfolio', { description: 'Positions and cash balance' }, async () => ({
    content: [{ type: 'text', text: JSON.stringify({ positions: [] }) }],
  }))
  server.registerTool('place_order', { description: 'Buy or sell a security' }, async () => {
    onOrder()
    return { content: [{ type: 'text', text: 'ordered' }] }
  })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  return { clientSide, onOrder }
}

describe('ScalableMcpClient', () => {
  it('discovers tools with allowlist decisions and calls only read tools', async () => {
    const { clientSide, onOrder } = await fakeServer()
    const client = new ScalableMcpClient(
      URL_,
      provider(),
      () => clientSide,
      new Set(['get_portfolio', 'place_order']),
    )
    expect(await client.connect()).toEqual({ status: 'connected' })

    const manifest = await client.discover()
    expect(manifest.tools.map((tool) => [tool.name, tool.allowed, tool.reason])).toEqual([
      ['get_portfolio', true, 'allowlisted'],
      ['place_order', false, 'denied_pattern'],
    ])

    const result = (await client.call('get_portfolio')) as { content: { text: string }[] }
    expect(JSON.parse(result.content[0]!.text)).toEqual({ positions: [] })

    await expect(client.call('place_order')).rejects.toBeInstanceOf(ForbiddenToolError)
    expect(onOrder).not.toHaveBeenCalled()
    await client.close()
  })

  it('returns the login URL when the server asks for authorization', async () => {
    const auth = provider()
    const failing: Transport = {
      start: async () => {
        auth.pendingAuthorizationUrl = new URL('https://auth.example/authorize?x=1')
        throw new UnauthorizedError()
      },
      send: async () => undefined,
      close: async () => undefined,
    }
    const client = new ScalableMcpClient(URL_, auth, () => failing)
    expect(await client.connect()).toEqual({
      status: 'authorization_required',
      authorizationUrl: 'https://auth.example/authorize?x=1',
    })
  })

  it('maps a failed refresh to AuthExpiredError and outages to UpstreamError', async () => {
    const unauthorized: Transport = {
      start: async () => {
        throw new UnauthorizedError()
      },
      send: async () => undefined,
      close: async () => undefined,
    }
    await expect(
      new ScalableMcpClient(URL_, provider(), () => unauthorized).connect(),
    ).rejects.toBeInstanceOf(AuthExpiredError)

    const down: Transport = {
      start: async () => {
        throw new Error('ECONNREFUSED')
      },
      send: async () => undefined,
      close: async () => undefined,
    }
    await expect(
      new ScalableMcpClient(URL_, provider(), () => down).connect(),
    ).rejects.toBeInstanceOf(UpstreamError)
  })
})
