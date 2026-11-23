import { createHash } from 'node:crypto'
import secureSession from '@fastify/secure-session'
import { ConfigService } from '@nestjs/config'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import './modules/auth/session.types'

export const SESSION_COOKIE = 'session'
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60

/**
 * Applies everything `main.ts` and the e2e tests share: prefix, logger,
 * sealed session cookie, zod validation, error format and (outside production)
 * Swagger at /api/docs.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api')
  app.useLogger(app.get(Logger))

  await app.register(secureSession, {
    cookieName: SESSION_COOKIE,
    // 32-byte key derived from API_SESSION_SECRET (>= 32 bytes, validated at startup).
    key: createHash('sha256').update(config.getOrThrow<string>('API_SESSION_SECRET')).digest(),
    expiry: SESSION_MAX_AGE_SECONDS,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.getOrThrow<boolean>('COOKIE_SECURE'),
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  })

  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalFilters(new HttpExceptionFilter())

  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Vermögenskompass API')
        .setVersion('0.1.0')
        .addCookieAuth(SESSION_COOKIE)
        .build(),
    )
    SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document))
  }
}
