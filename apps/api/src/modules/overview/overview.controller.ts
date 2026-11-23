import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { netWorthQuery, type NetWorthResponse } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { OverviewService } from './overview.service'

class NetWorthQueryDto extends createZodDto(netWorthQuery) {}

@ApiTags('overview')
@Controller('overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('net-worth')
  netWorth(@Query() query: NetWorthQueryDto): NetWorthResponse {
    return this.overview.netWorth(query)
  }
}
