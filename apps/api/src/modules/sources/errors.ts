/** Errors a DataSource may throw (contracts/data-source.md › Rules). */

/** A pull source tried to call a tool outside the read-only allowlist (FR-054). */
export class ForbiddenToolError extends Error {
  constructor(readonly toolName: string) {
    super(`Tool "${toolName}" is not on the read-only allowlist`)
    this.name = 'ForbiddenToolError'
  }
}

/** The stored grant expired or was revoked → source status `needs_reauth`. */
export class AuthExpiredError extends Error {
  constructor(message = 'Authorization expired') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

/** The upstream service failed → source status `error`, HTTP 502. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

/** The source exists only as a placeholder (Sparkasse, US7). */
export class NotImplementedError extends Error {
  constructor(message = 'Not implemented yet') {
    super(message)
    this.name = 'NotImplementedError'
  }
}
