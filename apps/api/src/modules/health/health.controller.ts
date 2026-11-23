import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'

/** Liveness + DB check for the Docker healthchecks. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  @Public()
  @Get()
  check(): { status: 'ok'; db: 'ok' } {
    try {
      this.db.$client.prepare('SELECT 1').get()
    } catch {
      throw new ServiceUnavailableException('Database unavailable')
    }
    return { status: 'ok', db: 'ok' }
  }
}
