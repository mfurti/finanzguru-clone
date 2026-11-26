import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/modules/auth/password'

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('korrektes pferd batterie')
    expect(stored.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('korrektes pferd batterie', stored)).toBe(true)
    expect(await verifyPassword('falsch', stored)).toBe(false)
  })

  it('salts each hash', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'))
  })

  it('rejects malformed stored values', async () => {
    expect(await verifyPassword('x', 'plain-text')).toBe(false)
  })
})
