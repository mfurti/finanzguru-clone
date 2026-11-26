/**
 * Read-only guard for Scalable MCP tools (FR-054, research R3).
 * A tool may be called only if it is on the explicit allowlist AND neither its
 * name nor its description looks like it could move money or change orders.
 * The check runs before anything is sent to the server.
 */
import { ForbiddenToolError } from '../errors'

/**
 * Read tools the sync uses, finalized from Scalable's real `tools/list` on
 * 2026-11-24 (004 T006; 36 tools, 23 marked read-only). All of them carry
 * `readOnlyHint: true`; everything that writes (watchlist, alerts, groups) or
 * touches orders and savings plans stays blocked.
 */
export const READ_TOOLS: ReadonlySet<string> = new Set<string>([
  'get_account_profile',
  'list_accessible_portfolios',
  'get_portfolio_overview',
  'get_portfolio_holdings',
  'get_portfolio_cash_breakdown',
  'list_portfolio_transactions',
  'get_overnight_summary',
  'list_overnight_transactions',
  // Market data for the watchlist (005 US4, research R6); read-only, no portfolio data.
  'search_securities',
  'get_security_quote',
  'get_security_chart',
])

/**
 * Anything that could place, change or cancel orders or move money (tasks.md T052).
 * Tool names: any occurrence. Descriptions: whole words only, so read tools that
 * merely mention e.g. "buying-power" are not caught (Scalable's real list, T006).
 */
export const DENY_PATTERN = /order|trade|buy|sell|cancel|transfer|savings.?plan|withdraw/i
export const DESCRIPTION_DENY_PATTERN =
  /\b(orders?|trades?|trading|buy|sell|cancel|transfers?|savings.?plans?|withdraw(al|als)?)\b/i

export interface ToolInfo {
  name: string
  description?: string
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

export interface ToolDecision {
  name: string
  allowed: boolean
  reason: 'allowlisted' | 'not_allowlisted' | 'denied_pattern' | 'not_read_only'
}

export function decideTool(
  tool: ToolInfo,
  allowlist: ReadonlySet<string> = READ_TOOLS,
): ToolDecision {
  if (DENY_PATTERN.test(tool.name) || DESCRIPTION_DENY_PATTERN.test(tool.description ?? '')) {
    return { name: tool.name, allowed: false, reason: 'denied_pattern' }
  }
  if (tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true) {
    return { name: tool.name, allowed: false, reason: 'not_read_only' }
  }
  if (!allowlist.has(tool.name)) {
    return { name: tool.name, allowed: false, reason: 'not_allowlisted' }
  }
  return { name: tool.name, allowed: true, reason: 'allowlisted' }
}

export function decideTools(
  tools: readonly ToolInfo[],
  allowlist: ReadonlySet<string> = READ_TOOLS,
): ToolDecision[] {
  return tools.map((tool) => decideTool(tool, allowlist))
}

export interface ToolCaller {
  callTool(params: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>
}

/**
 * Wraps an MCP client so only allowed tools reach the transport.
 * `known` are the tools from `tools/list` (descriptions matter for the check).
 */
export class ReadOnlyToolGuard {
  private readonly decisions: Map<string, ToolDecision>

  constructor(
    private readonly client: ToolCaller,
    known: readonly ToolInfo[],
    allowlist: ReadonlySet<string> = READ_TOOLS,
  ) {
    this.decisions = new Map(
      decideTools(known, allowlist).map((decision) => [decision.name, decision]),
    )
  }

  async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const decision = this.decisions.get(name)
    if (!decision?.allowed) throw new ForbiddenToolError(name)
    return this.client.callTool({ name, arguments: args })
  }
}
