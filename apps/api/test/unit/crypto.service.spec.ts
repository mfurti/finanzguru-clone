import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'
import { CryptoService } from '../../src/common/crypto.service'

const keyA = Buffer.alloc(32, 1).toString('base64')
const keyB = Buffer.alloc(32, 2).toString('base64')
const service = (key: string) => new CryptoService(new ConfigService({ API_ENCRYPTION_KEY: key }))

describe('CryptoService', () => {
  it('round-trips text and JSON', () => {
    const crypto = service(keyA)
    expect(crypto.decrypt(crypto.encrypt('geheim')).toString()).toBe('geheim')
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: 123 }
    expect(crypto.decryptJson(crypto.encryptJson(tokens))).toEqual(tokens)
  })

  it('uses a fresh IV per encryption', () => {
    const crypto = service(keyA)
    expect(crypto.encrypt('x').equals(crypto.encrypt('x'))).toBe(false)
  })

  it('detects tampering', () => {
    const crypto = service(keyA)
    const payload = crypto.encrypt('geheim')
    payload[payload.length - 1] ^= 0xff
    expect(() => crypto.decrypt(payload)).toThrow()
  })

  it('rejects payloads encrypted with another key', () => {
    expect(() => service(keyB).decrypt(service(keyA).encrypt('geheim'))).toThrow()
  })

  it('rejects keys that are not 32 bytes', () => {
    expect(() => service(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/)
  })

  it('rejects truncated payloads', () => {
    expect(() => service(keyA).decrypt(Buffer.alloc(10))).toThrow(/too short/)
  })
})
