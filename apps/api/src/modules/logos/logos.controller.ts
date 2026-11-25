import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { brandSearchQuery, type BrandSearchResult } from '@finance/shared'
import type { FastifyReply } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { LogosService } from './logos.service'

class BrandSearchDto extends createZodDto(brandSearchQuery) {}

/** Merchant logos (008): built-in brand catalogue; choices and uploads follow in US2/US3. */
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
}
