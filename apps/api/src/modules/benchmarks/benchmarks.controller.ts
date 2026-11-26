import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  type BenchmarkDto,
  type BenchmarkSeries,
  benchmarkSeriesQuery,
  type ChartSettings,
  chartSettings,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { BenchmarksService } from './benchmarks.service'

class SeriesQueryDto extends createZodDto(benchmarkSeriesQuery) {}
class ChartSettingsDto extends createZodDto(chartSettings) {}

@ApiTags('benchmarks')
@Controller()
export class BenchmarksController {
  constructor(private readonly benchmarks: BenchmarksService) {}

  @Get('benchmarks')
  list(): BenchmarkDto[] {
    return this.benchmarks.list()
  }

  @Get('benchmarks/:instrumentId/series')
  series(@Param('instrumentId') id: string, @Query() query: SeriesQueryDto): BenchmarkSeries {
    return this.benchmarks.series(id, query)
  }

  @Get('settings/charts')
  settings(): ChartSettings {
    return this.benchmarks.settings()
  }

  @Put('settings/charts')
  setSettings(@Body() body: ChartSettingsDto): ChartSettings {
    return this.benchmarks.setSettings(body)
  }
}
