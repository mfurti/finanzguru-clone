import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  period,
  type WatchlistDto,
  watchlistEntryInput,
  watchlistInput,
  type WatchlistSummary,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { WatchlistsService } from './watchlists.service'

class WatchlistInputDto extends createZodDto(watchlistInput) {}
class EntryInputDto extends createZodDto(watchlistEntryInput) {}
class PeriodQueryDto extends createZodDto(z.object({ period: period.default('1Y') })) {}

@ApiTags('watchlists')
@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlists: WatchlistsService) {}

  @Get()
  list(): WatchlistSummary[] {
    return this.watchlists.list()
  }

  @Post()
  create(@Body() body: WatchlistInputDto): WatchlistSummary {
    return this.watchlists.create(body)
  }

  @Get(':id')
  get(@Param('id') id: string, @Query() query: PeriodQueryDto): WatchlistDto {
    return this.watchlists.get(id, query.period)
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() body: WatchlistInputDto): WatchlistSummary {
    return this.watchlists.rename(id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.watchlists.remove(id)
  }

  /** Adds a security by ISIN; creates the instrument when it is unknown. */
  @Post(':id/entries')
  addEntry(@Param('id') id: string, @Body() body: EntryInputDto): WatchlistDto {
    return this.watchlists.addEntry(id, body)
  }

  @Delete(':id/entries/:instrumentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEntry(@Param('id') id: string, @Param('instrumentId') instrumentId: string): void {
    this.watchlists.removeEntry(id, instrumentId)
  }
}
