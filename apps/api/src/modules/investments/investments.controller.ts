import { Controller, Get, Param, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  accountsParam,
  type AssetClassDto,
  instrumentDetailQuery,
  investmentTransactionsQuery,
  performanceQuery,
  type PerformanceResponse,
  type PositionDto,
  positionsCsvQuery,
  positionsQuery,
} from '@finance/shared'
import type { FastifyReply } from 'fastify'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { InvestmentsDetailService, positionsToCsv } from './investments-detail.service'
import { InvestmentsService } from './investments.service'

class PerformanceQueryDto extends createZodDto(performanceQuery) {}
class PositionsQueryDto extends createZodDto(positionsQuery) {}
class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}
class PositionsCsvQueryDto extends createZodDto(positionsCsvQuery) {}
class InstrumentDetailQueryDto extends createZodDto(instrumentDetailQuery) {}
class InvestmentTransactionsQueryDto extends createZodDto(investmentTransactionsQuery) {}

@ApiTags('investments')
@Controller('investments')
export class InvestmentsController {
  constructor(
    private readonly investments: InvestmentsService,
    private readonly detail: InvestmentsDetailService,
  ) {}

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

  /** Visible columns of the positions table as CSV (FR-023). */
  @Get('positions.csv')
  positionsCsv(
    @Query() query: PositionsCsvQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): string {
    const rows = this.investments.positions(query)
    void reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="positionen.csv"')
    return positionsToCsv(rows, query.columns)
  }

  @Get('instruments/:id')
  instrument(@Param('id') id: string, @Query() query: InstrumentDetailQueryDto) {
    return this.detail.instrument(id, query)
  }

  @Get('transactions')
  transactions(@Query() query: InvestmentTransactionsQueryDto) {
    return this.detail.transactions(query)
  }
}
