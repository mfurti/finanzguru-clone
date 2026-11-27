import { Controller, Get, Inject } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AboutDto } from '@finance/shared'
import { appVersion, latestMigration } from '../../common/app-version'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { RefreshService } from '../refresh/refresh.service'

@ApiTags('about')
@Controller('about')
export class AboutController {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly refresh: RefreshService,
  ) {}

  /** Über die App (014 US4): version, schema, database size and the last fetch per source. */
  @Get()
  about(): AboutDto {
    const client = this.db.$client
    const pages = Number(client.pragma('page_count', { simple: true }))
    const pageSize = Number(client.pragma('page_size', { simple: true }))
    return {
      version: appVersion(),
      migration: latestMigration().tag,
      databaseBytes: pages * pageSize,
      sources: this.refresh.state().sources,
    }
  }
}
