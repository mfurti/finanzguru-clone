import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { AuthExpiredError, ForbiddenToolError, UpstreamError } from '../errors'
import {
  decideTools,
  READ_TOOLS,
  ReadOnlyToolGuard,
  type ToolDecision,
  type ToolInfo,
} from './allowlist'
import type { ScalableOAuthProvider } from './oauth-provider'

/** Per-request timeout for tool calls (tasks.md T053). */
export const TOOL_TIMEOUT_MS = 30_000

export type TransportFactory = (url: URL, provider: ScalableOAuthProvider) => Transport

export const httpTransport: TransportFactory = (url, provider) =>
  new StreamableHTTPClientTransport(url, { authProvider: provider })

export interface ToolManifest {
  discoveredAt: string
  tools: (ToolInfo & ToolDecision)[]
}

export type ConnectResult =
  { status: 'connected' } | { status: 'authorization_required'; authorizationUrl: string }

/**
 * Read-only MCP client for Scalable Capital. Tokens refresh through the SDK's
 * auth provider; when that fails the source needs re-authorization.
 */
export class ScalableMcpClient {
  private client: Client | null = null
  private transport: Transport | null = null
  private guard: ReadOnlyToolGuard | null = null
  private tools: ToolInfo[] = []

  constructor(
    private readonly url: URL,
    private readonly provider: ScalableOAuthProvider,
    private readonly createTransport: TransportFactory = httpTransport,
    private readonly allowlist: ReadonlySet<string> = READ_TOOLS,
  ) {}

  /** Connects; returns the login URL when the owner has to (re-)authorize. */
  async connect(): Promise<ConnectResult> {
    this.provider.pendingAuthorizationUrl = null
    this.transport = this.createTransport(this.url, this.provider)
    this.client = new Client({ name: 'vermoegenskompass', version: '0.1.0' }, { capabilities: {} })
    try {
      await this.client.connect(this.transport)
      return { status: 'connected' }
    } catch (error) {
      // Read through a method: TypeScript would keep the `null` from above narrowed.
      const url = this.pendingAuthorizationUrl()
      if (error instanceof UnauthorizedError || url) {
        if (url) return { status: 'authorization_required', authorizationUrl: url.toString() }
        throw new AuthExpiredError()
      }
      throw new UpstreamError('Scalable MCP server not reachable', error)
    }
  }

  /** Completes the OAuth code exchange after Scalable redirected back. */
  async finishAuth(code: string): Promise<void> {
    const transport = this.transport ?? this.createTransport(this.url, this.provider)
    if (!(transport instanceof StreamableHTTPClientTransport)) {
      throw new TypeError('finishAuth needs the HTTP transport')
    }
    try {
      await transport.finishAuth(code)
    } catch (error) {
      throw new UpstreamError('Authorization code exchange failed', error)
    }
  }

  /** `tools/list` plus the allowlist decision for each tool. */
  async discover(): Promise<ToolManifest> {
    const client = this.requireClient()
    let listed
    try {
      listed = await client.listTools(undefined, { timeout: TOOL_TIMEOUT_MS })
    } catch (error) {
      throw this.mapError(error)
    }
    this.tools = listed.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      annotations: tool.annotations
        ? {
            readOnlyHint: tool.annotations.readOnlyHint,
            destructiveHint: tool.annotations.destructiveHint,
          }
        : undefined,
    }))
    this.guard = new ReadOnlyToolGuard(client, this.tools, this.allowlist)
    const decisions = decideTools(this.tools, this.allowlist)
    return {
      discoveredAt: new Date().toISOString(),
      tools: this.tools.map((tool, index) => ({ ...tool, ...decisions[index]! })),
    }
  }

  /** Calls an allowlisted read tool; anything else throws ForbiddenToolError before sending. */
  async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.guard) await this.discover()
    try {
      return await this.guard!.call(name, args)
    } catch (error) {
      if (error instanceof ForbiddenToolError) throw error
      throw this.mapError(error)
    }
  }

  async close(): Promise<void> {
    await this.client?.close().catch(() => undefined)
    this.client = null
    this.guard = null
  }

  private pendingAuthorizationUrl(): URL | null {
    return this.provider.pendingAuthorizationUrl
  }

  private requireClient(): Client {
    if (!this.client) throw new Error('Not connected')
    return this.client
  }

  private mapError(error: unknown): Error {
    if (error instanceof UnauthorizedError) return new AuthExpiredError()
    const status = (error as { code?: number }).code
    if (status === 401 || status === 403) return new AuthExpiredError()
    return new UpstreamError(
      error instanceof Error ? error.message : 'Scalable MCP request failed',
      error,
    )
  }
}
