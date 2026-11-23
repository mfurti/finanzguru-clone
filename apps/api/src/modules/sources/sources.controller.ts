import { Controller, Get, Inject } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { DataSourceDto } from '@finance/shared'
import { asc } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { dataSource } from '../../database/schema'

@ApiTags('sources')
@Controller('sources')
export class SourcesController {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  /** Configured data sources; credentials are never part of the response. */
  @Get()
  list(): DataSourceDto[] {
    return this.db
      .select({
        id: dataSource.id,
        kind: dataSource.kind,
        status: dataSource.status,
        displayName: dataSource.displayName,
        lastSyncAt: dataSource.lastSyncAt,
        lastError: dataSource.lastError,
      })
      .from(dataSource)
      .orderBy(asc(dataSource.displayName))
      .all()
  }
}
