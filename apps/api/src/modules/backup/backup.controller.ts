import { Controller, Get, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { BackupService } from './backup.service'

@ApiTags('backup')
@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  /** Zip download: database snapshot, logos, manifest (014 US1). */
  @Get()
  download(@Res({ passthrough: true }) reply: FastifyReply): Buffer {
    const { fileName, body } = this.backup.create()
    void reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${fileName}"`)
      .header('cache-control', 'no-store')
    return body
  }
}
