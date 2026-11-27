import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator'
import { SessionsService } from './sessions.service'

/**
 * Global guard: every route needs the owner session unless marked `@Public()` (FR-060). The
 * cookie must name a live session row (014): ended or idle sessions count as logged out.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const sid = request.session?.get('sid')
    if (request.session?.get('owner') === true && typeof sid === 'string') {
      if (this.sessions.check(sid)) return true
      request.session.delete()
    }
    throw new UnauthorizedException('Nicht angemeldet')
  }
}
