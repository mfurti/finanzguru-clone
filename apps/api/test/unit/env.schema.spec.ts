import { describe, expect, it } from 'vitest'
import { validateEnv } from '../../src/config/env.schema'

const valid = {
  API_SESSION_SECRET: 'x'.repeat(32),
  API_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
}

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(valid)
    expect(env.PORT).toBe(3001)
    expect(env.COOKIE_SECURE).toBe(true)
    expect(env.DATABASE_PATH).toBe('./data/app.db')
  })

  it('parses COOKIE_SECURE=false', () => {
    expect(validateEnv({ ...valid, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false)
  })

  it('rejects a short session secret', () => {
    expect(() => validateEnv({ ...valid, API_SESSION_SECRET: 'short' })).toThrow(
      /API_SESSION_SECRET/,
    )
  })

  it('rejects an encryption key that is not 32 bytes', () => {
    expect(() => validateEnv({ ...valid, API_ENCRYPTION_KEY: 'AAAA' })).toThrow(
      /API_ENCRYPTION_KEY/,
    )
  })
})
