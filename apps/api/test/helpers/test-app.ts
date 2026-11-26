import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ModuleMetadata } from '@nestjs/common'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { Test } from '@nestjs/testing'
import { AppModule } from '../../src/app.module'
import { configureApp, createFastifyAdapter } from '../../src/app.setup'

/** Env for tests: in-memory DB, fixed secrets, plain-HTTP cookies. */
export function setTestEnv(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    LOGOS_DIR: mkdtempSync(join(tmpdir(), 'logos-')),
    // Empty unless a test passes its own folder: never pick up the owner's local logos.
    BRAND_LOGOS_DIR: mkdtempSync(join(tmpdir(), 'brand-logos-')),
    API_SESSION_SECRET: 'test-session-secret-0123456789abcdef',
    API_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    COOKIE_SECURE: 'false',
    ...overrides,
  })
}

/** Boots the full AppModule on Fastify, optionally with extra test-only modules. */
export async function createTestApp(
  extra: Pick<ModuleMetadata, 'imports' | 'controllers' | 'providers'> = {},
): Promise<NestFastifyApplication> {
  setTestEnv()
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(extra.imports ?? [])],
    controllers: extra.controllers ?? [],
    providers: extra.providers ?? [],
  }).compile()
  const app = moduleRef.createNestApplication<NestFastifyApplication>(createFastifyAdapter())
  await configureApp(app)
  await app.init()
  await app.getHttpAdapter().getInstance().ready()
  return app
}
