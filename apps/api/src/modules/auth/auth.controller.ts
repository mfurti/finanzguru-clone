import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { type OwnerSessionDto, passwordChangeInput } from '@finance/shared'
import { Public } from '../../common/decorators/public.decorator'
import { AuthService } from './auth.service'
import { SessionsService } from './sessions.service'

class LoginDto extends createZodDto(z.object({ password: z.string().min(1).max(200) })) {}
class PasswordChangeDto extends createZodDto(passwordChangeInput) {}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(@Body() body: LoginDto, @Req() request: FastifyRequest): Promise<void> {
    if (!(await this.auth.verify(body.password))) {
      throw new UnauthorizedException('Passwort falsch')
    }
    request.session.regenerate()
    request.session.set('owner', true)
    request.session.set('sid', this.sessions.create(request.headers['user-agent']))
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() request: FastifyRequest): void {
    const sid = request.session.get('sid')
    if (typeof sid === 'string') this.sessions.end(sid)
    request.session.delete()
  }

  /**
   * Change the password (014 US4): needs the current one; every other session ends, this one
   * stays logged in. Rate-limited like the login.
   */
  @UseGuards(ThrottlerGuard)
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() body: PasswordChangeDto,
    @Req() request: FastifyRequest,
  ): Promise<void> {
    if (!(await this.auth.verify(body.current))) {
      throw new BadRequestException('Aktuelles Passwort ist falsch')
    }
    await this.auth.changePassword(body.next)
    this.sessions.endOthers(request.session.get('sid')!)
  }

  /** Active logins of the owner, newest first (014 US4). */
  @Get('sessions')
  listSessions(@Req() request: FastifyRequest): OwnerSessionDto[] {
    return this.sessions.list(request.session.get('sid'))
  }

  /** "Überall abmelden": ends every session except this one. */
  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  endOtherSessions(@Req() request: FastifyRequest): void {
    this.sessions.endOthers(request.session.get('sid')!)
  }

  @Get('session')
  session(): { displayName: string } {
    return { displayName: this.auth.displayName() ?? '' }
  }
}
