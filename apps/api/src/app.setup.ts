import { ConfigService } from '@nestjs/config'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

/**
 * Applies everything `main.ts` and the e2e tests share: prefix, logger,
 * zod validation, error format and (outside production) Swagger at /api/docs.
 */
export function configureApp(app: NestFastifyApplication): void {
  app.setGlobalPrefix('api')
  app.useLogger(app.get(Logger))
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalFilters(new HttpExceptionFilter())

  const config = app.get(ConfigService)
  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Vermögenskompass API')
        .setVersion('0.1.0')
        .addCookieAuth('session')
        .build(),
    )
    SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document))
  }
}
