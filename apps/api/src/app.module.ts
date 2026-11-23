import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnv } from './config/env.schema'
import { DrizzleModule } from './database/drizzle.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    DrizzleModule,
  ],
})
export class AppModule {}
