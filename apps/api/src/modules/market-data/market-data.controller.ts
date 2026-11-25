import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  chartQuery,
  type ChartPoint,
  type QuoteDto,
  securitySearchQuery,
  type SecuritySearchResponse,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { MarketDataService } from './market-data.service'

class SearchQueryDto extends createZodDto(securitySearchQuery) {}
class ChartQueryDto extends createZodDto(chartQuery) {}

/** Security search, quotes and charts through the Scalable connection (005 US4). */
@ApiTags('market-data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly market: MarketDataService) {}

  /** Hits grouped by class; `available: false` without a Scalable connection. */
  @Get('search')
  search(@Query() query: SearchQueryDto): Promise<SecuritySearchResponse> {
    return this.market.search(query.q, query.class)
  }

  /** Stored quotes for `ids` (comma-separated instrument ids). */
  @Get('quotes')
  quotes(@Query('ids') ids = ''): QuoteDto[] {
    const list = ids.split(',').filter(Boolean)
    if (list.length > 200) throw new BadRequestException('Zu viele Wertpapiere')
    return this.market.quotes(list)
  }

  /** Starts a quote refresh; 409 without connection or while one runs. */
  @Post('refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  async refresh(): Promise<{ stored: number }> {
    return { stored: await this.market.refresh() }
  }

  @Get('chart/:instrumentId')
  chart(
    @Param('instrumentId') instrumentId: string,
    @Query() query: ChartQueryDto,
  ): Promise<ChartPoint[]> {
    return this.market.chart(instrumentId, query.range)
  }
}
