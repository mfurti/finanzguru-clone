import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  allocationQuery,
  type AllocationResponse,
  holdingsQuery,
  kpiQuery,
  type KpiResponse,
  netWorthQuery,
  type NetWorthResponse,
  type TopFlopResponse,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { OverviewService } from './overview.service'
import { PortfolioService } from './portfolio.service'

class NetWorthQueryDto extends createZodDto(netWorthQuery) {}
class AllocationQueryDto extends createZodDto(allocationQuery) {}
class KpiQueryDto extends createZodDto(kpiQuery) {}
class HoldingsQueryDto extends createZodDto(holdingsQuery) {}

@ApiTags('overview')
@Controller('overview')
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly portfolio: PortfolioService,
  ) {}

  @Get('net-worth')
  netWorth(@Query() query: NetWorthQueryDto): NetWorthResponse {
    return this.overview.netWorth(query)
  }

  @Get('allocation')
  allocation(@Query() query: AllocationQueryDto): AllocationResponse {
    return this.portfolio.allocation(query.accounts)
  }

  @Get('kpis')
  kpis(@Query() query: KpiQueryDto): KpiResponse {
    return this.portfolio.kpis(query)
  }

  @Get('holdings/top-flop')
  topFlop(@Query() query: HoldingsQueryDto): TopFlopResponse {
    return this.portfolio.topFlop(query)
  }
}
