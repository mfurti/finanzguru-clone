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
  /** Uploaded merchant logos (008); default: `logos/` next to the database file. */
  LOGOS_DIR: z.string().min(1).optional(),
  COOKIE_SECURE: booleanFromString.default(true),
  /** Scalable Capital MCP server (read-only sync, US3). */
  SCALABLE_MCP_URL: z.string().url().default('https://mcp.scalable.capital/mcp'),
  /** Must be reachable by the browser; goes through the web proxy. */
  SCALABLE_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3000/api/sources/scalable/callback'),
  /** Daily Scalable sync (004 T009); off unless set to "true". */
  SCALABLE_DAILY_SYNC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * Enable Banking application of the owner (005 R1, restricted production mode).
   * The private key stays in a local file outside the repository.
   */
  ENABLE_BANKING_APP_ID: z.string().uuid().optional(),
  ENABLE_BANKING_KEY_FILE: z.string().min(1).optional(),
  ENABLE_BANKING_API_URL: z.string().url().default('https://api.enablebanking.com'),
  /** Must be reachable by the browser and registered at Enable Banking. */
  ENABLE_BANKING_REDIRECT_URL: z
    .string()
    .url()
    .default('http://localhost:3000/api/sources/bank/callback'),
  /** Daily bank sync (005 T012); off unless set to "true". */
  BANK_DAILY_SYNC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
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
