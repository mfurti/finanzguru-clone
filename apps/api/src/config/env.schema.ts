import { z } from 'zod'

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1')

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_SESSION_SECRET: z.string().refine((value) => Buffer.byteLength(value, 'utf8') >= 32, {
    message: 'API_SESSION_SECRET must be at least 32 bytes',
  }),
  API_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'API_ENCRYPTION_KEY must be 32 bytes, base64 encoded',
  }),
  DATABASE_PATH: z.string().min(1).default('./data/app.db'),
  COOKIE_SECURE: booleanFromString.default(true),
  /** Login attempts per minute and client IP. */
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
})

export type Env = z.infer<typeof envSchema>

/** Validates process env for `ConfigModule.forRoot({ validate })`. */
export function validateEnv(config: Record<string, unknown>): Env {
  // API_PORT wins over PORT: tools that start web + api together set PORT for the web app.
  const withPort = config.API_PORT ? { ...config, PORT: config.API_PORT } : config
  const result = envSchema.safeParse(withPort)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment: ${issues}`)
  }
  return result.data
}
