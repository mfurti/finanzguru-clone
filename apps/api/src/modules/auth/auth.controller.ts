import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { Public } from '../../common/decorators/public.decorator'
import { AuthService } from './auth.service'

class LoginDto extends createZodDto(z.object({ password: z.string().min(1).max(200) })) {}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(@Body() body: LoginDto, @Req() request: FastifyRequest): Promise<void> {
    if (!(await this.auth.verify(body.password))) {
      throw new UnauthorizedException('Passwort falsch')
    }
    request.session.regenerate()
    request.session.set('owner', true)
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() request: FastifyRequest): void {
    request.session.delete()
  }

  @Get('session')
  session(): { displayName: string } {
    return { displayName: this.auth.displayName() ?? '' }
  }
}
