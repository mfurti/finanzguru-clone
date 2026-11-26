import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  type CashflowCategories,
  type CategoryDetail,
  cashflowCategoriesQuery,
  cashflowQuery,
  type CashflowSummary,
  type SankeyResponse,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { CashflowService } from './cashflow.service'

class CashflowQueryDto extends createZodDto(cashflowQuery) {}
class CashflowCategoriesQueryDto extends createZodDto(cashflowCategoriesQuery) {}

@ApiTags('cashflow')
@Controller('cashflow')
export class CashflowController {
  constructor(private readonly cashflow: CashflowService) {}

  @Get('summary')
  summary(@Query() query: CashflowQueryDto): CashflowSummary {
    return this.cashflow.summary(query)
  }

  @Get('sankey')
  sankey(@Query() query: CashflowQueryDto): SankeyResponse {
    return this.cashflow.sankey(query)
  }

  @Get('categories')
  categories(@Query() query: CashflowCategoriesQueryDto): CashflowCategories {
    return this.cashflow.categoryList(query)
  }

  /** Category detail: total in the period and 12-month history (003 US3). */
  @Get('categories/:id')
  categoryDetail(@Param('id') id: string, @Query() query: CashflowQueryDto): CategoryDetail {
    return this.cashflow.categoryDetail(id, query)
  }
}
