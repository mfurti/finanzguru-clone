import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import {
  csvConfirmInput,
  type CsvMappingDto,
  type CsvUploadResponse,
  type ImportJobDto,
} from '@finance/shared'
import type { FastifyRequest } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { ImportService } from './import.service'

class CsvConfirmDto extends createZodDto(csvConfirmInput) {}

@ApiTags('import')
@Controller()
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /** Multipart upload with one `file` field (max 20 MB). */
  @Post('import/csv')
  @ApiConsumes('multipart/form-data')
  async upload(@Req() request: FastifyRequest): Promise<CsvUploadResponse> {
    if (!request.isMultipart()) throw new BadRequestException('Erwarte multipart/form-data')
    const part = await request.file()
    if (!part) throw new BadRequestException('Keine Datei hochgeladen')
    let file: Buffer
    try {
      file = await part.toBuffer()
    } catch {
      throw new BadRequestException('Datei ist größer als 20 MB')
    }
    return this.imports.upload(file, part.filename)
  }

  @Post('import/csv/:jobId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('jobId') jobId: string, @Body() body: CsvConfirmDto): Promise<ImportJobDto> {
    return this.imports.confirm(jobId, body)
  }

  @Get('import/jobs/:id')
  job(@Param('id') id: string): ImportJobDto {
    return this.imports.job(id)
  }

  @Get('csv-mappings')
  mappings(): CsvMappingDto[] {
    return this.imports.mappings()
  }

  @Delete('csv-mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMapping(@Param('id') id: string): void {
    this.imports.deleteMapping(id)
  }
}
