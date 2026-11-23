import { Module, RequestMethod } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { LoggerModule } from 'nestjs-pino'
import { CommonModule } from './common/common.module'
import { validateEnv } from './config/env.schema'
import { DrizzleModule } from './database/drizzle.module'
import { AuthModule } from './modules/auth/auth.module'
import { HealthModule } from './modules/health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV')
        return {
          // Docker polls /api/health every 30 s; keep it out of the request log.
          exclude: [{ method: RequestMethod.GET, path: 'health' }],
          pinoHttp: {
            level: env === 'test' ? 'silent' : 'info',
            // Never log session cookies or auth headers.
            redact: {
              paths: [
                'req.headers.cookie',
                'req.headers.authorization',
                'res.headers["set-cookie"]',
              ],
              censor: '[redacted]',
            },
            transport:
              env === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
          },
        }
      },
    }),
    CommonModule,
    DrizzleModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
