import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter())
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
  const config = app.get(ConfigService)
  await app.listen(config.getOrThrow<number>('PORT'), '0.0.0.0')
}

void bootstrap()
