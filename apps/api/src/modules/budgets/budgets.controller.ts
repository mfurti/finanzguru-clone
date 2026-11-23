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
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { type BudgetDto, budgetInput } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { BudgetsService } from './budgets.service'

class BudgetDtoIn extends createZodDto(budgetInput) {}
class BudgetPatchDto extends createZodDto(budgetInput.partial()) {}

@ApiTags('budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  list(): BudgetDto[] {
    return this.budgets.list()
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
