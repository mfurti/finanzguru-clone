import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AuthService } from '../../src/modules/auth/auth.service'

const PASSWORD = 'test-owner-password'

/** Creates the owner and returns a session cookie header value for inject(). */
export async function loginCookie(app: NestFastifyApplication): Promise<string> {
  await app.get(AuthService).setOwner('Test', PASSWORD)
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { password: PASSWORD },
  })
  const header = res.headers['set-cookie']
  const value = Array.isArray(header) ? header[0] : header
  if (res.statusCode !== 204 || !value) throw new Error(`login failed: ${res.statusCode}`)
  return value.split(';')[0]!
}
