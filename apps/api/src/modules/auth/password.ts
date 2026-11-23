import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const COST = 2 ** 15
const BLOCK_SIZE = 8
const PARALLELISM = 1
const MAX_MEMORY = 128 * COST * BLOCK_SIZE * 2

function derive(password: string, salt: Buffer, cost: number, block: number, parallel: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: cost, r: block, p: parallel, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    )
  })
}

/** `scrypt$N$r$p$saltB64$hashB64` */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM)
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

/** Constant-time comparison against a stored `hashPassword` result. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, block, parallel, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !cost || !block || !parallel || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await derive(
    password,
    Buffer.from(saltB64, 'base64'),
    Number(cost),
    Number(block),
    Number(parallel),
  )
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
