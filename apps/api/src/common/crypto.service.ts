import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/**
 * Encrypts connection secrets at rest (FR-061).
 * Format: `iv (12 bytes) | auth tag (16 bytes) | ciphertext`.
 * The key is `API_ENCRYPTION_KEY` (32 bytes, base64).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer

  constructor(config: ConfigService) {
    this.key = Buffer.from(config.getOrThrow<string>('API_ENCRYPTION_KEY'), 'base64')
    if (this.key.length !== 32) {
      throw new Error('API_ENCRYPTION_KEY must decode to 32 bytes')
    }
  }

  encrypt(plaintext: string | Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH })
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext])
  }

  /** Throws if the payload was tampered with or encrypted with another key. */
  decrypt(payload: Buffer): Buffer {
    if (payload.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Encrypted payload is too short')
    }
    const iv = payload.subarray(0, IV_LENGTH)
    const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH })
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  encryptJson(value: unknown): Buffer {
    return this.encrypt(JSON.stringify(value))
  }

  decryptJson<T>(payload: Buffer): T {
    return JSON.parse(this.decrypt(payload).toString('utf8')) as T
  }
}
