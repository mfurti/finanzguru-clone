import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { type BackupManifest, BackupService } from './backup.service'

const MAX_BACKUP_BYTES = 512 * 1024 * 1024

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

  /** Staged restore, if any: the app applies it on the next start. */
  @Get('restore')
  pending(): { pending: BackupManifest | null } {
    return { pending: this.backup.pending() }
  }

  /** Upload a backup zip (`file` field): checked, then staged for the next start. */
  @Post('restore')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiConsumes('multipart/form-data')
  async restore(@Req() request: FastifyRequest): Promise<{ pending: BackupManifest }> {
    if (!request.isMultipart()) throw new BadRequestException('Erwarte multipart/form-data')
    const part = await request.file({ limits: { fileSize: MAX_BACKUP_BYTES } })
    if (!part) throw new BadRequestException('Keine Datei hochgeladen')
    let file: Buffer
    try {
      file = await part.toBuffer()
    } catch {
      throw new BadRequestException('Datei ist größer als 512 MB')
    }
    return { pending: this.backup.stage(file) }
  }

  /** Cancels a staged restore. */
  @Delete('restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(): void {
    this.backup.cancel()
  }
}
