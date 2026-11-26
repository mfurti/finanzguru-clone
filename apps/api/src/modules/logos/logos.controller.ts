import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import {
  brandSearchQuery,
  recipientKey,
  recipientLogoInput,
  type BrandSearchResult,
  type LogoRef,
} from '@finance/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { LogosService, MAX_LOGO_BYTES } from './logos.service'

class BrandSearchDto extends createZodDto(brandSearchQuery) {}
class RecipientLogoDto extends createZodDto(recipientLogoInput) {}

/** Recipient key from the URL: 1–200 characters (data-model.md). */
function keyParam(raw: string): string {
  const parsed = recipientKey.safeParse(raw)
  if (!parsed.success) throw new NotFoundException('Unbekannter Empfänger')
  return parsed.data
}

/** Merchant logos (008): built-in brand catalogue, choice per recipient, own uploads. */
@ApiTags('logos')
@Controller('logos')
export class LogosController {
  constructor(private readonly logos: LogosService) {}

  @Get('brands')
  search(@Query() query: BrandSearchDto): BrandSearchResult[] {
    return this.logos.search(query.q, query.limit)
  }

  /** Glyph in brand colour; versioned URL, so browsers may cache it for a year. */
  @Get('brands/:slug.svg')
  brand(@Param('slug') slug: string, @Res({ passthrough: true }) reply: FastifyReply): string {
    const svg = /^[a-z0-9]{1,60}$/.test(slug) ? this.logos.svg(slug) : null
    if (!svg) throw new NotFoundException('Unbekannte Marke')
    void reply
      .header('content-type', 'image/svg+xml; charset=utf-8')
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
    return svg
  }

  /** Brand or "Kein Logo" for all bookings of a recipient (US2). */
  @Put('recipients/:key')
  setChoice(@Param('key') key: string, @Body() body: RecipientLogoDto): LogoRef {
    return this.logos.setChoice(keyParam(key), body)
  }

  /** Own logo for all bookings of a recipient (US3): PNG, JPEG or WebP up to 256 KB. */
  @Post('recipients/:key/upload')
  @ApiConsumes('multipart/form-data')
  async upload(@Param('key') key: string, @Req() request: FastifyRequest): Promise<LogoRef> {
    const recipient = keyParam(key)
    if (!request.isMultipart()) throw new BadRequestException('Erwarte multipart/form-data')
    const part = await request.file({ limits: { fileSize: MAX_LOGO_BYTES, files: 1 } })
    if (!part) throw new BadRequestException('Keine Datei hochgeladen')
    let file: Buffer
    try {
      file = await part.toBuffer()
    } catch {
      throw new PayloadTooLargeException('Bild zu groß (max. 256 KB)')
    }
    return this.logos.saveUpload(recipient, file)
  }

  /** Uploaded logo; only for the logged-in owner, never sniffed as another type. */
  @Get('files/:name')
  file(@Param('name') name: string, @Res({ passthrough: true }) reply: FastifyReply): Buffer {
    const { body, contentType } = this.logos.readUpload(name)
    void reply
      .header('content-type', contentType)
      .header('cache-control', 'private, max-age=86400')
      .header('x-content-type-options', 'nosniff')
    return body
  }

  /** Back to the automatic match. */
  @Delete('recipients/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeChoice(@Param('key') key: string): void {
    this.logos.removeChoice(keyParam(key))
  }
}
