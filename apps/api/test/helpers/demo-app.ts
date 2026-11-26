import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DB } from '../../src/database/database.constants'
import { type DemoResult, seedDemo } from '../../src/database/demo'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { loginCookie } from './auth'
import { createTestApp } from './test-app'

/** App with the demo dataset and a logged-in session. */
export async function createDemoApp(): Promise<{
  app: NestFastifyApplication
  cookie: string
  demo: DemoResult
}> {
  const app = await createTestApp()
  const demo = seedDemo(app.get<AppDatabase>(DB))
  const cookie = await loginCookie(app)
  return { app, cookie, demo }
}
