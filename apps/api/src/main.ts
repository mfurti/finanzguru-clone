import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import { configureApp, createFastifyAdapter } from './app.setup'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter(), {
    bufferLogs: true,
  })
  await configureApp(app)
  app.enableShutdownHooks()
  const config = app.get(ConfigService)
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0')
}

void bootstrap()
