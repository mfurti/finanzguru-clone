import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  accountsParam,
  type AssetClassDto,
  performanceQuery,
  type PerformanceResponse,
  type PositionDto,
  positionsQuery,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { InvestmentsService } from './investments.service'

class PerformanceQueryDto extends createZodDto(performanceQuery) {}
class PositionsQueryDto extends createZodDto(positionsQuery) {}
class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}

@ApiTags('investments')
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get('performance')
  performance(@Query() query: PerformanceQueryDto): PerformanceResponse {
    return this.investments.performance(query)
  }

  @Get('positions')
  positions(@Query() query: PositionsQueryDto): PositionDto[] {
    return this.investments.positions(query)
  }

  @Get('asset-classes')
  assetClasses(@Query() query: AccountsQueryDto): AssetClassDto[] {
    return this.investments.assetClasses(query.accounts)
  }
}
