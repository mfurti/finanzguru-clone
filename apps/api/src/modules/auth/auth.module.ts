import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SessionGuard } from './session.guard'
import { SessionsService } from './sessions.service'

@Module({
  imports: [
    // Applied only where @UseGuards(ThrottlerGuard) is set (login): LOGIN_RATE_LIMIT per minute.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60_000, limit: config.getOrThrow<number>('LOGIN_RATE_LIMIT') },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
