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
import { type BudgetDto, budgetInput, type BudgetsOverview } from '@finance/shared'
import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'
import { BudgetsService } from './budgets.service'

class BudgetDtoIn extends createZodDto(budgetInput) {}
class OverviewQueryDto extends createZodDto(
  z.object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
  }),
) {}
class BudgetPatchDto extends createZodDto(budgetInput.partial()) {}

@ApiTags('budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(): BudgetDto[] {
    return this.budgets.list()
  }

  /** Budgets page: table and 12-month chart (003 US4). */
  @Get('overview')
  overview(@Query() query: OverviewQueryDto): BudgetsOverview {
    return this.budgets.overview(query.period)
  }

  @Post()
  create(@Body() body: BudgetDtoIn): BudgetDto {
    return this.budgets.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: BudgetPatchDto): BudgetDto {
    return this.budgets.update(id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.budgets.remove(id)
  }
}
